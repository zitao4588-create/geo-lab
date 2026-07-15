import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { BusinessType, DiagnosisInput, PageAuditResult, PageAuditTarget } from '../shared/types.js';
import { extractModelIdentifiers, includesEntityAlias } from './entityIdentity.js';
import { inferBusinessType, normalizeCompactText, normalizeIdentity } from './domain.js';

type ResolveHostname = (hostname: string) => Promise<string[]>;

export interface PageAuditOptions {
  fetchImpl?: typeof fetch;
  resolveHostname?: ResolveHostname;
  renderPage?: (url: string, signal: AbortSignal) => Promise<string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  allowedPrivateHosts?: string[];
}

interface FetchedResource {
  status: number;
  contentType: string;
  text: string;
  finalUrl: string;
  fetchedAt: string;
  contentHash: string;
  freshness: PageAuditTarget['freshness'];
  sourceUpdatedAt?: string;
  renderMode: PageAuditTarget['renderMode'];
}

const nativeFetch = globalThis.fetch;

interface AuditSpec {
  id: string;
  name: string;
  path: string;
  requiredFacts: string[];
  kind: 'html' | 'text' | 'xml';
}

type DiscoverableAuditId = 'privacy' | 'faq';

interface SubmittedAuditResult {
  target: PageAuditTarget;
  discoveredUrls: Partial<Record<DiscoverableAuditId, string>>;
}

const discoverySpecs: AuditSpec[] = [
  { id: 'privacy', name: '隐私政策页', path: '/privacy.html', requiredFacts: ['privacy', 'data'], kind: 'html' },
  { id: 'features', name: '功能说明页', path: '/features/', requiredFacts: ['feature', 'category'], kind: 'html' },
  { id: 'faq', name: 'FAQ/常见问题', path: '/faq/', requiredFacts: ['faq'], kind: 'html' },
  { id: 'geo-case', name: 'GEO 自证案例', path: '/geo-case/', requiredFacts: ['geo', 'brand'], kind: 'html' },
  { id: 'robots', name: 'robots.txt', path: '/robots.txt', requiredFacts: ['sitemap'], kind: 'text' },
  { id: 'sitemap', name: 'sitemap.xml', path: '/sitemap.xml', requiredFacts: ['home', 'privacy', 'faq'], kind: 'xml' },
  { id: 'llms', name: 'llms.txt', path: '/llms.txt', requiredFacts: ['brand', 'category', 'privacy'], kind: 'text' }
];

export async function auditSubmittedPages(input: DiagnosisInput, options: PageAuditOptions = {}): Promise<PageAuditResult> {
  const submittedUrls = extractSubmittedUrls(input.links ?? '');
  const generatedAt = new Date().toISOString();

  if (submittedUrls.length === 0) {
    return {
      generatedAt,
      score: 0,
      submittedSourceScore: 0,
      siteInfrastructureScore: 0,
      targets: [],
      summary: {
        ok: 0,
        warn: 0,
        missing: discoverySpecs.length + 1,
        failed: 0,
        note: '未提交可审计的公开网址。'
      }
    };
  }

  const submittedUrl = submittedUrls[0]!;
  const parsed = new URL(submittedUrl);
  const baseUrl = `${parsed.protocol}//${parsed.host}`;
  const facts = buildFactDictionary(input);
  const auditDeadlineAt = Date.now() + (options.timeoutMs ?? 8_000);
  const submittedAudit = await auditSubmittedUrl(submittedUrl, input, withRemainingAuditTime(options, auditDeadlineAt));
  const discoveryOptions = withRemainingAuditTime(options, auditDeadlineAt);
  const discoveredTargets = await Promise.all(discoverySpecs.map((spec) => {
    const discoveredUrl = isDiscoverableAuditId(spec.id) ? submittedAudit.discoveredUrls[spec.id] : undefined;
    return auditDiscoveredUrl(
      discoveredUrl ?? new URL(spec.path, baseUrl).toString(),
      spec,
      facts,
      discoveryOptions,
      discoveredUrl ? { submittedUrl, discoveredFromSubmittedPage: true } : undefined
    );
  }));
  const targets = [submittedAudit.target, ...discoveredTargets];
  const summary = summarizeTargets(targets);
  const submittedSourceScore = scoreSubmittedSource(targets[0]);
  const siteInfrastructureScore = scoreTargets(targets.slice(1));

  return {
    baseUrl,
    generatedAt,
    score: scoreTargets(targets),
    submittedSourceScore,
    siteInfrastructureScore,
    targets,
    summary: {
      ...summary,
      note: `${summary.note} 提交来源 ${submittedSourceScore}/100，站点基建 ${siteInfrastructureScore}/100。`
    }
  };
}

function withRemainingAuditTime(options: PageAuditOptions, deadlineAt: number): PageAuditOptions {
  const configuredTimeout = options.timeoutMs ?? 8_000;
  return {
    ...options,
    timeoutMs: Math.max(1, Math.min(configuredTimeout, deadlineAt - Date.now()))
  };
}

async function auditSubmittedUrl(url: string, input: DiagnosisInput, options: PageAuditOptions): Promise<SubmittedAuditResult> {
  const startedAt = new Date().toISOString();
  try {
    const resource = await fetchAuditResource(url, 'html', options);
    const html = resource.text;
    const visibleText = normalizeCompactText(htmlToText(html));
    const title = extractTitle(html);
    const description = extractMetaDescription(html);
    const canonicalUrl = extractCanonical(html, url);
    const sourceRelation = determineSourceRelation(input, title, description);
    const businessType = inferBusinessType(input);
    const scopeRelation = determineScopeRelation(input, businessType, url, visibleText, sourceRelation);
    const { matchedFacts, missingFacts } = buildSubmittedFacts(input, businessType, url, title, description, visibleText, sourceRelation);
    const okHttp = resource.status >= 200 && resource.status < 300;
    const status = !okHttp
      ? 'missing'
      : sourceRelation === 'entity_matched' && scopeRelation === 'matched' && missingFacts.length === 0
        ? 'ok'
        : 'warn';
    const notes = [
      `HTTP ${resource.status}`,
      sourceRelation === 'entity_matched' ? '页面内容与目标实体匹配。' : sourceRelation === 'unrelated' ? '页面内容与目标实体不匹配。' : '页面与目标实体的关系无法确认。',
      scopeNote(scopeRelation),
      ...(matchedFacts.length > 0 ? [`命中事实：${matchedFacts.join('、')}`] : []),
      ...(missingFacts.length > 0 ? [`缺少事实：${missingFacts.join('、')}`] : [])
    ];

    return {
      target: {
        id: 'submitted',
        name: '用户提交入口',
        url,
        status,
        httpStatus: resource.status,
        contentType: resource.contentType,
        title,
        description,
        canonicalUrl,
        matchedFacts,
        missingFacts,
        notes,
        fetchedAt: resource.fetchedAt,
        evidenceLabel: okHttp ? 'verified_external' : 'suggested_supplement',
        sourceRelation,
        scopeRelation,
        submitted: true,
        finalUrl: resource.finalUrl,
        contentHash: resource.contentHash,
        matchedEvidence: buildMatchedEvidence(visibleText, matchedFacts, input),
        freshness: resource.freshness,
        sourceUpdatedAt: resource.sourceUpdatedAt,
        renderMode: resource.renderMode
      },
      discoveredUrls: discoverOneHopAuditUrls(html, resource.finalUrl, url)
    };
  } catch (error) {
    return {
      target: {
        id: 'submitted',
        name: '用户提交入口',
        url,
        status: 'failed',
        matchedFacts: [],
        missingFacts: ['页面可访问性', '实体关系', '业务范围'],
        notes: [error instanceof Error ? safeError(error.message) : '抓取失败'],
        fetchedAt: startedAt,
        evidenceLabel: 'suggested_supplement',
        sourceRelation: 'unknown',
        scopeRelation: 'unknown',
        submitted: true,
        freshness: 'invalid'
      },
      discoveredUrls: {}
    };
  }
}

async function auditDiscoveredUrl(
  url: string,
  spec: AuditSpec,
  facts: Record<string, string[]>,
  options: PageAuditOptions,
  discovery?: { submittedUrl: string; discoveredFromSubmittedPage: boolean }
): Promise<PageAuditTarget> {
  const fetchedAt = new Date().toISOString();

  try {
    const resource = await fetchAuditResource(url, spec.kind, options);
    const text = resource.text;
    const visibleText = normalizeCompactText(spec.kind === 'html' ? htmlToText(text) : text);
    const title = spec.kind === 'html' ? extractTitle(text) : undefined;
    const description = spec.kind === 'html' ? extractMetaDescription(text) : undefined;
    const matchedFacts = findMatchedFacts(visibleText, spec.requiredFacts, facts);
    const missingFacts = spec.requiredFacts.filter((fact) => !matchedFacts.includes(fact));
    const okHttp = resource.status >= 200 && resource.status < 300;
    const staysOnSubmittedSite = !discovery || isWithinSubmittedSite(resource.finalUrl, discovery.submittedUrl);
    const status = !okHttp ? 'missing' : !staysOnSubmittedSite ? 'warn' : missingFacts.length === 0 ? 'ok' : 'warn';
    const notes = buildNotes(spec, resource.status, matchedFacts, missingFacts);
    if (discovery?.discoveredFromSubmittedPage) notes.unshift('从用户提交页的一跳官方链接发现。');
    if (!staysOnSubmittedSite) notes.push('跳转后超出用户提交站点的注册域，未作为已核验官方页面。');

    return {
      id: spec.id,
      name: spec.name,
      url,
      status,
      httpStatus: resource.status,
      contentType: resource.contentType,
      title,
      description,
      matchedFacts,
      missingFacts,
      notes,
      fetchedAt: resource.fetchedAt,
      evidenceLabel: okHttp && staysOnSubmittedSite ? 'verified_external' : 'suggested_supplement',
      sourceRelation: status === 'ok' ? 'entity_matched' : 'unknown',
      scopeRelation: status === 'ok' ? 'matched' : 'unknown',
      finalUrl: resource.finalUrl,
      contentHash: resource.contentHash,
      matchedEvidence: buildDictionaryEvidence(visibleText, matchedFacts, facts),
      freshness: resource.freshness,
      sourceUpdatedAt: resource.sourceUpdatedAt,
      renderMode: resource.renderMode
    };
  } catch (error) {
    return {
      id: spec.id,
      name: spec.name,
      url,
      status: 'failed',
      matchedFacts: [],
      missingFacts: spec.requiredFacts,
      notes: [error instanceof Error ? safeError(error.message) : '抓取失败'],
      fetchedAt,
      evidenceLabel: 'suggested_supplement',
      sourceRelation: 'unknown',
      scopeRelation: 'unknown',
      freshness: 'invalid'
    };
  }
}

function discoverOneHopAuditUrls(html: string, pageUrl: string, submittedUrl: string): Partial<Record<DiscoverableAuditId, string>> {
  const best = new Map<DiscoverableAuditId, { url: string; score: number }>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)) {
    const attributes = match[1] ?? '';
    const hrefMatch = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/iu);
    const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    if (!href) continue;
    let candidate: URL;
    try {
      candidate = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if ((candidate.protocol !== 'http:' && candidate.protocol !== 'https:') || candidate.username || candidate.password) continue;
    if (!isWithinSubmittedSite(candidate.toString(), submittedUrl)) continue;
    candidate.hash = '';
    const label = `${candidate.hostname} ${candidate.pathname} ${htmlToText(match[2] ?? '')}`;
    for (const id of ['privacy', 'faq'] as const) {
      const score = scoreDiscoveredLink(id, label);
      if (score <= 0) continue;
      const current = best.get(id);
      if (!current || score > current.score || (score === current.score && candidate.toString().length < current.url.length)) {
        best.set(id, { url: candidate.toString(), score });
      }
    }
  }
  return Object.fromEntries([...best.entries()].map(([id, value]) => [id, value.url]));
}

function scoreDiscoveredLink(id: DiscoverableAuditId, label: string) {
  const normalized = normalizeCompactText(label);
  if (id === 'privacy') {
    const direct = normalized.match(/privacy|隐私政策|隐私保护|个人信息保护/giu)?.length ?? 0;
    const dataPolicy = /data[-_/ ]?(?:policy|privacy)|数据政策/iu.test(label) ? 1 : 0;
    return direct * 3 + dataPolicy * 2;
  }
  if (/privacy|隐私政策|个人信息保护/iu.test(label)) return 0;
  const direct = normalized.match(/faq|常见问题|帮助中心|使用指南|帮助|文档/giu)?.length ?? 0;
  const hostSignal = /^(?:help|support|docs)\./iu.test(new URL(`https://${label.trim().split(/\s+/u)[0]}`).hostname) ? 1 : 0;
  return direct * 3 + hostSignal;
}

function isDiscoverableAuditId(value: string): value is DiscoverableAuditId {
  return value === 'privacy' || value === 'faq';
}

function isWithinSubmittedSite(candidateUrl: string, submittedUrl: string) {
  try {
    const candidateHost = normalizeSiteHostname(new URL(candidateUrl).hostname);
    const submittedHost = normalizeSiteHostname(new URL(submittedUrl).hostname);
    const submittedWithoutWww = submittedHost.replace(/^www\./u, '');
    const rootDomain = registrableDomain(submittedWithoutWww);
    const boundary = submittedWithoutWww === rootDomain ? rootDomain : submittedWithoutWww;
    const candidateWithoutWww = candidateHost.replace(/^www\./u, '');
    return candidateWithoutWww === boundary || candidateWithoutWww.endsWith(`.${boundary}`);
  } catch {
    return false;
  }
}

function registrableDomain(hostname: string) {
  const normalized = normalizeSiteHostname(hostname).replace(/^www\./u, '');
  if (isIP(normalized) || !normalized.includes('.')) return normalized;
  const labels = normalized.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const secondLevelCountrySuffixes = new Set(['ac', 'co', 'com', 'edu', 'gov', 'net', 'org']);
  const usesSecondLevelCountrySuffix = labels.at(-1)?.length === 2 && secondLevelCountrySuffixes.has(labels.at(-2) ?? '');
  return labels.slice(usesSecondLevelCountrySuffix ? -3 : -2).join('.');
}

function normalizeSiteHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/u, '');
}

function extractSubmittedUrls(links: string) {
  return [...new Set((links.match(/https?:\/\/[^\s，,；;]+/giu) ?? []).map((value) => value.replace(/[。.!?）)]+$/gu, '')).filter((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }))];
}

function determineSourceRelation(
  input: DiagnosisInput,
  title: string | undefined,
  description: string | undefined
): PageAuditTarget['sourceRelation'] {
  const pageIdentity = `${title ?? ''} ${description ?? ''}`;
  const submittedIdentity = `${input.businessName} ${input.industry}`;
  const pageNormalized = normalizeIdentity(pageIdentity);
  const submittedNormalized = normalizeIdentity(submittedIdentity);
  if (!pageNormalized) return 'unknown';
  if (includesEntityAlias(pageIdentity, input) || pageNormalized.includes(normalizeIdentity(input.businessName)) || submittedNormalized.includes(pageNormalized)) return 'entity_matched';

  const generic = /^(官网|首页|产品|服务|工具|软件|应用|平台|小程序|门店|门店服务|本地服务|电动剃须刀|剃须刀|家电|天气|天气预报)$/u;
  const pageTerms = pageIdentity.match(/[\p{Script=Han}]{2,12}/gu) ?? [];
  const matched = pageTerms.filter((term) => !generic.test(term) && submittedNormalized.includes(normalizeIdentity(term)));
  return matched.length > 0 ? 'entity_matched' : 'unrelated';
}

function determineScopeRelation(
  input: DiagnosisInput,
  businessType: BusinessType,
  url: string,
  visibleText: string,
  sourceRelation: PageAuditTarget['sourceRelation']
): PageAuditTarget['scopeRelation'] {
  if (sourceRelation === 'unrelated') return 'mismatched';
  if (sourceRelation !== 'entity_matched') return 'unknown';
  const parsed = new URL(url);
  const isRoot = parsed.pathname === '/' || parsed.pathname === '';

  if (businessType === 'local_service') {
    const city = normalizeCompactText(input.city);
    const hasCity = city.length > 0 && visibleText.includes(city);
    const hasLocalEntry = /store|shop|location|门店|餐厅|预约|排队/iu.test(`${parsed.pathname} ${visibleText}`);
    if (hasCity && hasLocalEntry) return 'matched';
    if (hasLocalEntry && !isRoot) return 'partial';
    return 'mismatched';
  }

  if (businessType === 'physical_product') {
    return extractPrimaryModels(url).length > 0 || !isRoot ? 'matched' : 'partial';
  }

  return isRoot && businessType === 'generic_or_unknown' ? 'unknown' : 'matched';
}

function buildSubmittedFacts(
  input: DiagnosisInput,
  businessType: BusinessType,
  url: string,
  title: string | undefined,
  description: string | undefined,
  visibleText: string,
  sourceRelation: PageAuditTarget['sourceRelation']
) {
  const matchedFacts: string[] = [];
  const requiredFacts: string[] = ['brand'];
  if (sourceRelation === 'entity_matched') matchedFacts.push('brand');

  if (businessType === 'physical_product') {
    requiredFacts.push('category', 'model');
    if (visibleText.includes(normalizeCompactText(input.industry)) || /剃须刀|刀头|马达|电器|商品/u.test(visibleText)) matchedFacts.push('category');
    const models = extractPrimaryModels(`${url} ${title ?? ''} ${description ?? ''}`);
    if (models.length > 0) matchedFacts.push('model', ...models);
  } else if (businessType === 'local_service') {
    requiredFacts.push('entry', input.city);
    if (/store|shop|location|门店|餐厅|预约|排队/iu.test(`${new URL(url).pathname} ${visibleText}`)) matchedFacts.push('entry');
    if (normalizeCompactText(input.city) && visibleText.includes(normalizeCompactText(input.city))) matchedFacts.push(input.city);
  } else {
    requiredFacts.push('category', 'entry');
    if (visibleText.includes(normalizeCompactText(input.industry)) || /软件|小程序|应用|平台|网站|GEO/iu.test(visibleText)) matchedFacts.push('category');
    if (new URL(url).pathname !== '/' || /使用|入口|功能|产品/u.test(visibleText)) matchedFacts.push('entry');
  }

  return {
    matchedFacts: unique(matchedFacts),
    missingFacts: requiredFacts.filter((fact) => !matchedFacts.includes(fact))
  };
}

function extractPrimaryModels(value: string) {
  return extractModelIdentifiers(decodeURIComponent(value));
}

function extractCanonical(html: string, fallbackUrl: string) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/iu)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/iu);
  if (!match?.[1]) return fallbackUrl;
  try {
    return new URL(match[1], fallbackUrl).toString();
  } catch {
    return fallbackUrl;
  }
}

function scopeNote(value: PageAuditTarget['scopeRelation']) {
  if (value === 'matched') return '页面范围与目标实体层级匹配。';
  if (value === 'partial') return '页面是相关入口，但不足以证明具体型号、城市或门店。';
  if (value === 'mismatched') return '页面层级与目标实体范围不匹配。';
  return '页面能够证明的业务范围无法确认。';
}

function buildFactDictionary(input: DiagnosisInput): Record<string, string[]> {
  return {
    brand: [input.businessName],
    category: [input.industry, 'GEO', '诊断工具', '软件', '小程序', '应用', '平台'],
    entry: ['产品入口', '公开入口', '使用', '功能', '报告'],
    privacy: ['隐私', 'privacy', '/privacy.html', '个人信息', '数据'],
    data: ['数据', '业务资料', '模型服务', '联系方式', '本地 runtime'],
    feature: ['功能', '/features/', 'features', '实体认知', '自然推荐', '来源可信度', '站点基建', '报告'],
    faq: ['常见问题', 'FAQ', '/faq/', 'faq', '问答', '是否'],
    geo: ['GEO', 'AI', '实体认知', '公开证据', '证据边界', 'llms.txt'],
    sitemap: ['Sitemap', 'sitemap.xml'],
    home: ['/', new URL((input.links ?? '').match(/https?:\/\/[^\s，,；;]+/u)?.[0] ?? 'https://example.com').host],
    features: ['/features'],
    faq_path: ['/faq']
  };
}

function findMatchedFacts(text: string, requiredFacts: string[], facts: Record<string, string[]>) {
  return requiredFacts.filter((fact) => (facts[fact] ?? [fact]).some((keyword) => text.includes(normalizeCompactText(keyword))));
}

function buildMatchedEvidence(text: string, matchedFacts: string[], input: DiagnosisInput) {
  const aliases = [
    input.businessName,
    input.businessName.replace(input.city, '').replace(/(?:具体)?门店(?:服务)?|产品|软件|小程序|应用|平台/gu, '').trim(),
    input.industry
  ].filter(Boolean);
  return matchedFacts.map((fact) => {
    const keywords = fact === 'brand' ? aliases : fact === 'category' ? [input.industry] : [fact];
    return { fact, snippet: findSnippet(text, keywords) ?? fact };
  });
}

function buildDictionaryEvidence(text: string, matchedFacts: string[], facts: Record<string, string[]>) {
  return matchedFacts.map((fact) => ({ fact, snippet: findSnippet(text, facts[fact] ?? [fact]) ?? fact }));
}

function findSnippet(text: string, keywords: string[]) {
  const normalized = normalizeCompactText(text);
  for (const keyword of keywords) {
    const needle = normalizeCompactText(keyword);
    if (!needle) continue;
    const index = normalized.indexOf(needle);
    if (index >= 0) return normalized.slice(Math.max(0, index - 32), Math.min(normalized.length, index + needle.length + 64));
  }
  return undefined;
}

function summarizeTargets(targets: PageAuditTarget[]) {
  const ok = targets.filter((target) => target.status === 'ok').length;
  const warn = targets.filter((target) => target.status === 'warn').length;
  const missing = targets.filter((target) => target.status === 'missing').length;
  const failed = targets.filter((target) => target.status === 'failed').length;
  return {
    ok,
    warn,
    missing,
    failed,
    note: `完成 ${targets.length} 个 URL 审计：${ok} 个通过，${warn} 个需补强，${missing + failed} 个不可用。`
  };
}

function scoreTargets(targets: PageAuditTarget[]) {
  if (targets.length === 0) return 0;
  const weighted = targets.reduce((total, target) => {
    if (target.status === 'ok') return total + 1;
    if (target.status === 'warn') return total + 0.55;
    return total;
  }, 0);
  return Math.round((weighted / targets.length) * 100);
}

function scoreSubmittedSource(target: PageAuditTarget | undefined) {
  if (!target || target.status === 'missing' || target.status === 'failed' || target.sourceRelation === 'unrelated') return 0;
  if (target.sourceRelation !== 'entity_matched') return 20;
  if (target.scopeRelation === 'matched' && target.status === 'ok') return 100;
  if (target.scopeRelation === 'partial') return 60;
  if (target.scopeRelation === 'mismatched') return 30;
  return 40;
}

function buildNotes(spec: AuditSpec, httpStatus: number, matchedFacts: string[], missingFacts: string[]) {
  const notes = [`HTTP ${httpStatus}`];
  if (matchedFacts.length > 0) notes.push(`命中事实：${matchedFacts.join('、')}`);
  if (missingFacts.length > 0) notes.push(`缺少事实：${missingFacts.join('、')}`);
  return notes;
}

export async function validateAuditUrl(
  value: string,
  options: { resolveHostname?: ResolveHostname; allowedPrivateHosts?: string[]; recheck?: boolean } = {}
) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported_url_protocol');
  if (parsed.username || parsed.password) throw new Error('url_credentials_not_allowed');
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, '');
  const allowed = new Set(options.allowedPrivateHosts ?? configuredPrivateHosts());
  if (allowed.has(hostname)) return [hostname];
  if (isIP(hostname)) {
    if (isPrivateOrReservedAddress(hostname)) throw new Error('private_or_reserved_address');
    return [hostname];
  }
  const resolver = options.resolveHostname ?? defaultResolveHostname;
  const first = await resolver(hostname);
  if (first.length === 0 || first.some(isPrivateOrReservedAddress)) throw new Error('private_or_reserved_address');
  if (options.recheck) {
    const second = await resolver(hostname);
    if (second.length === 0 || second.some(isPrivateOrReservedAddress) || !sameAddresses(first, second)) {
      throw new Error('dns_rebinding_or_private_address');
    }
  }
  return first;
}

async function fetchAuditResource(url: string, kind: AuditSpec['kind'], options: PageAuditOptions): Promise<FetchedResource> {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxBytes = options.maxBytes ?? 1_000_000;
  const maxRedirects = options.maxRedirects ?? 4;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const resolveHostname = options.resolveHostname ?? (fetchImpl === nativeFetch ? undefined : async () => ['93.184.216.34']);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('fetch_timeout')), timeoutMs);
  try {
    let currentUrl = url;
    const visited = new Set<string>();
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (visited.has(currentUrl)) throw new Error('redirect_loop');
      visited.add(currentUrl);
      await validateAuditUrl(currentUrl, {
        resolveHostname,
        allowedPrivateHosts: options.allowedPrivateHosts,
        recheck: true
      });
      let response: Response;
      try {
        response = await fetchImpl(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'user-agent': 'AIExposureCheckH5/0.5 (+https://exposure.playgamelab.cn)' }
        });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw new Error('fetch_timeout');
        throw error;
      }
      if (isRedirect(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('redirect_without_location');
        if (hop >= maxRedirects) throw new Error('too_many_redirects');
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      const contentType = response.headers.get('content-type') ?? '';
      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > maxBytes) throw new Error('response_too_large');
      if (response.ok && !isSupportedContentType(contentType, kind)) throw new Error('unsupported_content_type');
      let text = await readResponseText(response, maxBytes);
      let renderMode: PageAuditTarget['renderMode'] = 'static';
      if (kind === 'html' && response.ok && options.renderPage && looksLikeJavaScriptShell(text)) {
        const rendered = await options.renderPage(currentUrl, controller.signal);
        if (new TextEncoder().encode(rendered).byteLength > maxBytes) throw new Error('rendered_response_too_large');
        text = rendered;
        renderMode = 'controlled_dynamic';
      }
      const fetchedAt = new Date().toISOString();
      const sourceUpdatedAt = normalizeHttpDate(response.headers.get('last-modified'));
      return {
        status: response.status,
        contentType,
        text,
        finalUrl: currentUrl,
        fetchedAt,
        contentHash: createHash('sha256').update(text).digest('hex'),
        freshness: determineFreshness(sourceUpdatedAt, fetchedAt),
        sourceUpdatedAt,
        renderMode
      };
    }
    throw new Error('too_many_redirects');
  } finally {
    clearTimeout(timer);
  }
}

async function defaultResolveHostname(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function configuredPrivateHosts() {
  return (process.env.PAGE_AUDIT_ALLOW_PRIVATE_HOSTS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
}

function isPrivateOrReservedAddress(address: string) {
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu)?.[1];
  if (mapped) return isPrivateOrReservedAddress(mapped);
  if (address === '::1' || address === '::' || /^::ffff:/iu.test(address) || /^fe[89ab][0-9a-f]:/iu.test(address) || /^(?:fc|fd)/iu.test(address) || /^2001:db8:/iu.test(address)) return true;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(address)) return false;
  const [a = -1, b = -1] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0);
}

function sameAddresses(left: string[], right: string[]) {
  return [...left].sort().join(',') === [...right].sort().join(',');
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isSupportedContentType(contentType: string, kind: AuditSpec['kind']) {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (kind === 'html') return normalized === 'text/html' || normalized === 'application/xhtml+xml';
  if (kind === 'xml') return normalized === 'application/xml' || normalized === 'text/xml';
  return normalized === 'text/plain';
}

function looksLikeJavaScriptShell(html: string) {
  const visible = normalizeCompactText(htmlToText(html));
  return visible.length < 80 && /<script\b|id=["'](?:app|root)["']/iu.test(html);
}

async function readResponseText(response: Response, maxBytes: number) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel('response_too_large');
      throw new Error('response_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function normalizeHttpDate(value: string | null) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function determineFreshness(sourceUpdatedAt: string | undefined, fetchedAt: string): PageAuditTarget['freshness'] {
  if (!sourceUpdatedAt) return 'current';
  const ageDays = (Date.parse(fetchedAt) - Date.parse(sourceUpdatedAt)) / 86_400_000;
  return ageDays > 180 ? 'possibly_stale' : 'current';
}

function extractTitle(html: string) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.trim() ?? '');
}

function extractMetaDescription(html: string) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/iu)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/iu);
  return decodeHtml(match?.[1]?.trim() ?? '');
}

function htmlToText(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/giu, ' ')
      .replace(/<style[\s\S]*?<\/style>/giu, ' ')
      .replace(/<[^>]+>/gu, ' ')
      .replace(/\s+/gu, ' ')
  );
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function safeError(value: string) {
  return value.slice(0, 180);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
