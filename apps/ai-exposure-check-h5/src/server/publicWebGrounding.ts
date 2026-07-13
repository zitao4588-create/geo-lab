import type { DiagnosisInput, PublicWebGrounding } from '../shared/types.js';
import {
  getWebSearchRuntime,
  searchPublicWeb,
  webSearchProviderIds,
  type WebSearchProviderId,
  type WebSearchResponse
} from './providers/webSearch.js';

export interface PublicWebGroundingOptions {
  deadlineAt?: number;
  env?: NodeJS.ProcessEnv;
  captureRawResponse?: boolean;
}

export function getPublicWebGroundingRuntime(env: NodeJS.ProcessEnv = process.env) {
  const providers = readProviders(env);
  const providerRuntime = getWebSearchRuntime(env).providers;
  const enabled = readBoolean(env.PUBLIC_WEB_GROUNDING_ENABLED, false);
  return {
    enabled,
    provider: providers.length === 1 ? providers[0] : 'multi',
    providers: providers.map((provider) => {
      const runtime = providerRuntime.find((item) => item.provider === provider);
      return {
        provider,
        active: enabled && Boolean(runtime?.active),
        configured: Boolean(runtime?.configured),
        providerEnabled: Boolean(runtime?.enabled)
      };
    }),
    active: enabled && providers.some((provider) => providerRuntime.find((item) => item.provider === provider)?.active)
  };
}

export async function collectPublicWebGrounding(
  input: DiagnosisInput,
  options: PublicWebGroundingOptions = {}
): Promise<WebSearchResponse[]> {
  const env = options.env ?? process.env;
  const runtime = getPublicWebGroundingRuntime(env);
  const query = buildGroundingQuery(input);
  const searchedAt = new Date().toISOString();

  if (!runtime.enabled) {
    return runtime.providers.map((provider) => skipped(provider.provider, query, searchedAt, 'public_web_grounding_disabled'));
  }

  const remainingMs = options.deadlineAt === undefined
    ? readBoundedInteger(env.WEB_SEARCH_TIMEOUT_MS, 30_000, 1_000, 30_000)
    : options.deadlineAt - Date.now();
  if (remainingMs < 1_000) {
    return runtime.providers.map((provider) => skipped(provider.provider, query, searchedAt, 'diagnosis_deadline_exhausted'));
  }

  return Promise.all(runtime.providers.map((provider) => {
    if (!provider.active) return skipped(provider.provider, query, searchedAt, 'public_web_grounding_provider_inactive');
    return searchPublicWeb(provider.provider, query, {
      env,
      maxResults: 5,
      timeoutMs: Math.min(30_000, remainingMs),
      captureRawResponse: options.captureRawResponse ?? true
    });
  }));
}

export function toPublicWebGrounding(input: DiagnosisInput, responses: WebSearchResponse[]): PublicWebGrounding {
  const successful = responses.filter((response) => response.status === 'success');
  const failed = responses.filter((response) => response.status === 'failed');
  const results = mergeCandidates(input, responses);
  const discovery = buildDiscoveryScore(input, responses, results);
  const status = successful.length === responses.length && successful.length > 0
    ? 'success'
    : successful.length > 0
      ? 'partial'
      : failed.length > 0
        ? 'failed'
        : 'skipped';
  const note = successful.length > 0
    ? `${successful.length}/${responses.length} 个联网来源成功，合并得到 ${results.length} 个候选公开来源；只计入“公开证据可发现度”，不作为已核验事实或消费端曝光。`
    : failed.length > 0
      ? '联网候选来源未在整单截止时间内完成；报告已降级生成，未伪造搜索结果。'
      : '本次未启用可用的联网候选来源，报告仅使用模型采样与已提交来源。';
  const provider = responses.length === 1 ? responses[0]?.provider ?? 'multi' : 'multi';
  const errors = responses.flatMap((response) => response.error ? [`${response.provider}:${response.error}`] : []);
  return {
    provider,
    providers: responses.map((response) => ({
      provider: response.provider,
      status: response.status,
      latencyMs: response.latencyMs,
      resultCount: response.results.length,
      ...(response.usage ? { usage: response.usage } : {}),
      ...(response.error ? { error: response.error } : {})
    })),
    status,
    query: responses[0]?.query ?? buildGroundingQuery(input),
    searchedAt: responses[0]?.searchedAt ?? new Date().toISOString(),
    latencyMs: Math.max(0, ...responses.map((response) => response.latencyMs)),
    results,
    discovery,
    ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
    note,
    evidenceLabel: 'suggested_supplement'
  };
}

function mergeCandidates(input: DiagnosisInput, responses: WebSearchResponse[]): PublicWebGrounding['results'] {
  const merged = new Map<string, PublicWebGrounding['results'][number]>();
  const brandTokens = buildBrandTokens(input.businessName);
  const officialDomains = extractOfficialDomains(input.links ?? '');
  for (const response of responses) {
    if (response.status !== 'success') continue;
    for (const result of response.results) {
      const key = normalizeCandidateUrl(result.url);
      const existing = merged.get(key);
      const providers = [...new Set([...(existing?.providers ?? []), response.provider])];
      const searchable = normalizeSearchText(`${result.title} ${result.url} ${result.snippet}`);
      const brandMatched = brandTokens.some((token) => searchable.includes(token));
      const officialCandidate = matchesOfficialDomain(result.url, officialDomains);
      merged.set(key, {
        title: existing?.title && existing.title.length >= result.title.length ? existing.title : result.title,
        url: existing?.url ?? result.url,
        snippet: existing?.snippet && existing.snippet.length >= result.snippet.length ? existing.snippet : result.snippet,
        providers,
        brandMatched: Boolean(existing?.brandMatched) || brandMatched,
        officialCandidate: Boolean(existing?.officialCandidate) || officialCandidate
      });
    }
  }
  return [...merged.values()].slice(0, 10);
}

function buildDiscoveryScore(
  input: DiagnosisInput,
  responses: WebSearchResponse[],
  results: PublicWebGrounding['results']
): PublicWebGrounding['discovery'] {
  const successful = responses.filter((response) => response.status === 'success');
  const successfulProviders = new Set(successful.map((response) => response.provider));
  const brandProviders = new Set(results.filter((result) => result.brandMatched).flatMap((result) => result.providers ?? []));
  const officialProviders = new Set(results.filter((result) => result.officialCandidate).flatMap((result) => result.providers ?? []));
  const domains = new Map<string, Set<WebSearchProviderId>>();
  for (const result of results) {
    const domain = toDomainKey(result.url);
    if (!domain) continue;
    const providers = domains.get(domain) ?? new Set<WebSearchProviderId>();
    for (const provider of result.providers ?? []) providers.add(provider);
    domains.set(domain, providers);
  }
  const corroboratedDomainCount = [...domains.values()].filter((providers) => providers.size >= 2).length;
  const providerBase = Math.max(1, successfulProviders.size);
  const completion = responses.length === 0 ? 0 : successfulProviders.size / responses.length;
  const brandCoverage = brandProviders.size / providerBase;
  const officialDomains = extractOfficialDomains(input.links ?? '');
  const officialCoverage = officialDomains.length > 0 ? officialProviders.size / providerBase : 0;
  const score = clampScore(Math.round(
    completion * 20 +
    brandCoverage * 45 +
    officialCoverage * 25 +
    (corroboratedDomainCount > 0 ? 10 : 0)
  ));
  const status = successfulProviders.size === 0
    ? 'unavailable'
    : brandProviders.size > 0
      ? 'available'
      : 'partial';
  const officialNote = officialDomains.length > 0
    ? `其中 ${officialProviders.size}/${successfulProviders.size} 个成功来源找到了提交官网域名。`
    : '未提交官网 URL，因此不计算官网命中项。';
  return {
    score,
    status,
    attemptedProviderCount: responses.length,
    successfulProviderCount: successfulProviders.size,
    candidateCount: results.length,
    brandMatchedCandidateCount: results.filter((result) => result.brandMatched).length,
    officialCandidateCount: results.filter((result) => result.officialCandidate).length,
    corroboratedDomainCount,
    note: `该分数只衡量候选公开来源是否容易被发现：联网完成 20%、品牌候选 45%、提交官网命中 25%、跨来源同域支持 10%。${officialNote}`
  };
}

function buildGroundingQuery(input: DiagnosisInput) {
  return [input.businessName, input.industry, input.city, '官网 官方 可信来源']
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 240);
}

function skipped(provider: WebSearchProviderId, query: string, searchedAt: string, error: string): WebSearchResponse {
  return { provider, query, status: 'skipped', searchedAt, latencyMs: 0, results: [], error };
}

function readProviders(env: NodeJS.ProcessEnv): WebSearchProviderId[] {
  const raw = env.PUBLIC_WEB_GROUNDING_PROVIDERS || env.PUBLIC_WEB_GROUNDING_PROVIDER || 'volcengine';
  const providers = raw
    .split(',')
    .map((value) => value.trim().toLowerCase() as WebSearchProviderId)
    .filter((value) => webSearchProviderIds.includes(value));
  const selected: WebSearchProviderId[] = providers.length > 0 ? providers : ['volcengine'];
  return [...new Set(selected)];
}

function buildBrandTokens(value: string) {
  const normalized = normalizeSearchText(value);
  const tokens = value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalizeSearchText)
    .filter((token) => token.length >= 2 && !['公司', '产品', '品牌', '官方', '有限公司'].includes(token));
  if (normalized.length >= 3) tokens.push(normalized);
  return [...new Set(tokens)];
}

function extractOfficialDomains(value: string) {
  const urls = value.match(/https?:\/\/[^\s,，;；]+/giu) ?? [];
  return [...new Set(urls.flatMap((url) => {
    try {
      return [new URL(url).hostname.toLowerCase().replace(/^www\./u, '')];
    } catch {
      return [];
    }
  }))];
}

function matchesOfficialDomain(value: string, domains: string[]) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./u, '');
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function normalizeCandidateUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|irclickid|irgwc|afsrc|partner)/iu.test(key)) url.searchParams.delete(key);
    }
    return `${url.hostname.toLowerCase().replace(/^www\./u, '')}${url.pathname.replace(/\/$/u, '')}${url.search}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function toDomainKey(value: string) {
  try {
    const labels = new URL(value).hostname.toLowerCase().replace(/^www\./u, '').split('.');
    if (labels.length <= 2) return labels.join('.');
    const suffix = labels.slice(-2).join('.');
    return ['com.cn', 'net.cn', 'org.cn', 'co.uk'].includes(suffix)
      ? labels.slice(-3).join('.')
      : suffix;
  } catch {
    return '';
  }
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function readBoundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}
