export const webSearchProviderIds = ['anysearch', 'tavily', 'jina', 'volcengine'] as const;

export type WebSearchProviderId = typeof webSearchProviderIds[number];

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface WebSearchResponse {
  provider: WebSearchProviderId;
  query: string;
  status: 'success' | 'skipped' | 'failed';
  searchedAt: string;
  latencyMs: number;
  results: WebSearchResult[];
  answer?: string;
  usage?: Record<string, number>;
  rawResponse?: unknown;
  error?: string;
}

export interface WebSearchProviderRuntime {
  provider: WebSearchProviderId;
  enabled: boolean;
  configured: boolean;
  active: boolean;
  baseUrl: string;
  model?: string;
  costNote: string;
}

export interface WebSearchOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  maxResults?: number;
  timeoutMs?: number;
  captureRawResponse?: boolean;
}

interface WebSearchProviderConfig extends WebSearchProviderRuntime {
  apiKey?: string;
  allowAnonymous?: boolean;
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function getWebSearchRuntime(env: NodeJS.ProcessEnv = process.env) {
  return {
    providers: getWebSearchProviderConfigs(env).map(({ apiKey: _apiKey, allowAnonymous: _allowAnonymous, ...provider }) => provider)
  };
}

export async function searchPublicWeb(
  provider: WebSearchProviderId,
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResponse> {
  const normalizedQuery = normalizeQuery(query);
  const env = options.env ?? process.env;
  const config = getWebSearchProviderConfigs(env).find((item) => item.provider === provider);
  const searchedAt = new Date().toISOString();
  const startedAt = Date.now();

  if (!config) return failedResponse(provider, normalizedQuery, searchedAt, startedAt, 'unknown_search_provider', 'failed');
  if (!config.enabled) return failedResponse(provider, normalizedQuery, searchedAt, startedAt, 'search_provider_disabled', 'skipped');
  if (!config.configured) return failedResponse(provider, normalizedQuery, searchedAt, startedAt, 'search_provider_not_configured', 'skipped');

  const maxResults = readBoundedInteger(String(options.maxResults ?? env.WEB_SEARCH_MAX_RESULTS ?? ''), 5, 1, 10);
  const timeoutMs = readBoundedInteger(String(options.timeoutMs ?? env.WEB_SEARCH_TIMEOUT_MS ?? ''), 12_000, 1_000, 30_000);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const { url, init } = buildRequest(config, normalizedQuery, maxResults, signal);
    const response = await fetchImpl(url, init);
    const rawText = await readBoundedText(response);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${extractErrorMessage(rawText)}`);

    const payload = parsePayload(rawText);
    return {
      provider,
      query: normalizedQuery,
      status: 'success',
      searchedAt,
      latencyMs: Date.now() - startedAt,
      results: normalizeResults(payload, maxResults),
      ...extractAnswer(payload),
      ...extractUsage(payload),
      ...(options.captureRawResponse ? { rawResponse: payload } : {})
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'search_failed';
    return failedResponse(provider, normalizedQuery, searchedAt, startedAt, sanitizeSearchError(message), 'failed');
  }
}

export async function searchActiveProviders(query: string, options: WebSearchOptions = {}) {
  const env = options.env ?? process.env;
  const activeProviders = getWebSearchProviderConfigs(env).filter((provider) => provider.active);
  return Promise.all(activeProviders.map((provider) => searchPublicWeb(provider.provider, query, options)));
}

function getWebSearchProviderConfigs(env: NodeJS.ProcessEnv): WebSearchProviderConfig[] {
  const anysearchKey = env.ANYSEARCH_API_KEY?.trim();
  const anysearchAnonymous = readBoolean(env.ANYSEARCH_ALLOW_ANONYMOUS, false);
  const tavilyKey = env.TAVILY_API_KEY?.trim();
  const jinaKey = env.JINA_API_KEY?.trim();
  const volcengineKey = (env.VOLCENGINE_WEB_SEARCH_API_KEY || env.ARK_API_KEY || env.DOUBAO_API_KEY)?.trim();
  const volcengineModel = env.VOLCENGINE_WEB_SEARCH_MODEL || env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260215';

  return [
    providerConfig({
      provider: 'anysearch',
      enabled: readBoolean(env.ANYSEARCH_SEARCH_ENABLED, false),
      configured: Boolean(anysearchKey) || anysearchAnonymous,
      baseUrl: env.ANYSEARCH_BASE_URL || 'https://api.anysearch.com',
      apiKey: anysearchKey,
      allowAnonymous: anysearchAnonymous,
      costNote: '只用于后端候选来源发现；公开商业 H5 启用前仍需确认使用条款，并设置额度停止条件。'
    }),
    providerConfig({
      provider: 'tavily',
      enabled: readBoolean(env.TAVILY_SEARCH_ENABLED, false),
      configured: Boolean(tavilyKey),
      baseUrl: env.TAVILY_BASE_URL || 'https://api.tavily.com',
      apiKey: tavilyKey,
      costNote: 'basic search 每次 1 credit；免费计划当前为每月 1000 credits。'
    }),
    providerConfig({
      provider: 'jina',
      enabled: readBoolean(env.JINA_SEARCH_ENABLED, false),
      configured: Boolean(jinaKey),
      baseUrl: env.JINA_SEARCH_BASE_URL || 'https://s.jina.ai',
      apiKey: jinaKey,
      costNote: '搜索会消耗 Jina tokens；免费 token 池耗尽时必须停止。'
    }),
    providerConfig({
      provider: 'volcengine',
      enabled: readBoolean(env.VOLCENGINE_SEARCH_ENABLED, false),
      configured: Boolean(volcengineKey) && Boolean(volcengineModel),
      baseUrl: env.VOLCENGINE_RESPONSES_URL || 'https://ark.cn-beijing.volces.com/api/v3/responses',
      apiKey: volcengineKey,
      model: volcengineModel,
      costNote: '联网资源可能在月度免费额度内，但 Responses API 仍可能产生模型 Token 费用。'
    })
  ];
}

function providerConfig(config: Omit<WebSearchProviderConfig, 'active'>): WebSearchProviderConfig {
  return { ...config, active: config.enabled && config.configured };
}

function buildRequest(config: WebSearchProviderConfig, query: string, maxResults: number, signal: AbortSignal) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  if (config.provider === 'jina') {
    return {
      url: `${config.baseUrl.replace(/\/$/u, '')}/${encodeURIComponent(query)}`,
      init: { method: 'GET', headers, signal } satisfies RequestInit
    };
  }

  headers['Content-Type'] = 'application/json';
  if (config.provider === 'anysearch') {
    return {
      url: `${config.baseUrl.replace(/\/$/u, '')}/v1/search`,
      init: {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({ query, max_results: maxResults, content_types: ['web'] })
      } satisfies RequestInit
    };
  }

  if (config.provider === 'tavily') {
    return {
      url: `${config.baseUrl.replace(/\/$/u, '')}/search`,
      init: {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          topic: 'general',
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false,
          auto_parameters: false
        })
      } satisfies RequestInit
    };
  }

  return {
    url: config.baseUrl,
    init: {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: config.model,
        input: query,
        tools: [{ type: 'web_search' }],
        store: false,
        max_output_tokens: 800
      })
    } satisfies RequestInit
  };
}

async function readBoundedText(response: Response) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error('search_response_too_large');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('search_response_too_large');
  return text;
}

function parsePayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return { answer: trimmed, results: parseMarkdownResults(trimmed) };
  }
}

function parseMarkdownResults(text: string) {
  const results: Array<Record<string, string>> = [];
  const lines = text.split('\n');
  let title = '';
  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+(?:\d+\.\s*)?(.+)$/u);
    if (heading) title = heading[1]?.trim() || '';
    const urlMatch = line.match(/(?:\*\*URL\*\*:\s*|Source:\s*|\]\()(?<url>https?:\/\/[^\s)]+)/iu);
    const url = urlMatch?.groups?.url;
    if (url) results.push({ title, url, snippet: '' });
  }
  return results;
}

function normalizeResults(payload: unknown, maxResults: number) {
  const candidates: Record<string, unknown>[] = [];
  collectResultCandidates(payload, candidates, new Set());
  const seen = new Set<string>();
  const results: WebSearchResult[] = [];

  for (const candidate of candidates) {
    const url = firstString(candidate.url, candidate.link, candidate.href, candidate.source_url);
    if (!url || !isPublicHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    const title = compact(firstString(candidate.title, candidate.name, candidate.source_name) || new URL(url).hostname, 240);
    const snippet = compact(firstText(candidate.description, candidate.snippet, candidate.summary, candidate.content, candidate.text), 1200);
    const score = typeof candidate.score === 'number' && Number.isFinite(candidate.score) ? candidate.score : undefined;
    results.push({ title, url, snippet, ...(score === undefined ? {} : { score }) });
    if (results.length >= maxResults) break;
  }
  return results;
}

function collectResultCandidates(value: unknown, output: Record<string, unknown>[], visited: Set<object>) {
  if (!value || typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectResultCandidates(item, output, visited);
    return;
  }
  const record = value as Record<string, unknown>;
  const hasUrl = ['url', 'link', 'href', 'source_url'].some((key) => typeof record[key] === 'string');
  const hasContext = ['title', 'name', 'description', 'snippet', 'summary', 'content', 'text'].some((key) => record[key] !== undefined);
  if (hasUrl && hasContext) output.push(record);
  for (const nested of Object.values(record)) collectResultCandidates(nested, output, visited);
}

function extractAnswer(payload: unknown): { answer?: string } {
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  const direct = firstString(record.answer, record.output_text);
  if (direct) return { answer: compact(direct, 8000) };
  const texts: string[] = [];
  collectOutputTexts(payload, texts, new Set());
  const answer = texts.map((item) => item.trim()).filter(Boolean).join('\n').trim();
  return answer ? { answer: compact(answer, 8000) } : {};
}

function collectOutputTexts(value: unknown, output: string[], visited: Set<object>) {
  if (!value || typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectOutputTexts(item, output, visited);
    return;
  }
  const record = value as Record<string, unknown>;
  if (['output_text', 'text'].includes(String(record.type)) && typeof record.text === 'string') output.push(record.text);
  for (const nested of Object.values(record)) collectOutputTexts(nested, output, visited);
}

function extractUsage(payload: unknown): { usage?: Record<string, number> } {
  if (!payload || typeof payload !== 'object') return {};
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return {};
  const numericEntries = Object.entries(usage as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  return numericEntries.length > 0 ? { usage: Object.fromEntries(numericEntries) } : {};
}

function extractErrorMessage(text: string) {
  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    const error = payload.error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
      return String((error as Record<string, unknown>).message);
    }
    if (typeof payload.message === 'string') return payload.message;
  } catch {
    // Fall back to the bounded response excerpt below.
  }
  return compact(text || 'search_failed', 500);
}

function failedResponse(
  provider: WebSearchProviderId,
  query: string,
  searchedAt: string,
  startedAt: number,
  error: string,
  status: WebSearchResponse['status']
): WebSearchResponse {
  return {
    provider,
    query,
    status,
    searchedAt,
    latencyMs: Date.now() - startedAt,
    results: [],
    error
  };
}

export function sanitizeSearchError(message: string) {
  return compact(message, 1000)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [redacted]')
    .replace(/(?:tvly-|jina_|sk-)[A-Za-z0-9._-]{8,}/giu, '[redacted_key]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[redacted_ip]');
}

function normalizeQuery(query: string) {
  const normalized = String(query || '').replace(/\s+/gu, ' ').trim();
  if (!normalized) throw new Error('search_query_required');
  if (normalized.length > 500) throw new Error('search_query_too_long');
  return normalized;
}

function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const text = value.filter((item): item is string => typeof item === 'string').join(' ');
      if (text.trim()) return text;
    }
  }
  return '';
}

function compact(value: string, maxLength: number) {
  const normalized = String(value || '').replace(/\s+/gu, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function readBoundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}
