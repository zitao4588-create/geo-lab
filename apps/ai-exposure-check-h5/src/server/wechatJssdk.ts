import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ORIGIN = 'https://exposure.playgamelab.cn';
const JS_API_LIST = ['updateAppMessageShareData', 'updateTimelineShareData'] as const;
const MAX_SIGNED_URL_LENGTH = 2048;
const REFRESH_WINDOW_SECONDS = 300;

interface WechatCredentialCache {
  accessToken?: string;
  accessTokenExpiresAt?: number;
  jsapiTicket?: string;
  jsapiTicketExpiresAt?: number;
}

interface WechatApiResponse {
  errcode?: number;
  errmsg?: string;
  expires_in?: number;
  access_token?: string;
  ticket?: string;
}

export interface WechatJssdkOptions {
  appId?: string;
  appSecret?: string;
  allowedOrigin?: string;
  cacheFile?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  nonce?: () => string;
}

export interface WechatJssdkConfig {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
  jsApiList: readonly string[];
}

const memoryCaches = new Map<string, WechatCredentialCache>();
const refreshes = new Map<string, Promise<WechatCredentialCache>>();

export function getWechatJssdkRuntime(options: WechatJssdkOptions = {}) {
  const appId = options.appId ?? process.env.WECHAT_JSSDK_APP_ID ?? '';
  const appSecret = options.appSecret ?? process.env.WECHAT_JSSDK_APP_SECRET ?? '';
  return {
    configured: Boolean(appId && appSecret),
    appIdConfigured: Boolean(appId),
    appSecretConfigured: Boolean(appSecret),
    allowedOrigin: options.allowedOrigin ?? process.env.WECHAT_JSSDK_ALLOWED_ORIGIN ?? DEFAULT_ORIGIN
  };
}

export async function buildWechatJssdkConfig(rawUrl: string, options: WechatJssdkOptions = {}): Promise<WechatJssdkConfig> {
  const appId = options.appId ?? process.env.WECHAT_JSSDK_APP_ID ?? '';
  const appSecret = options.appSecret ?? process.env.WECHAT_JSSDK_APP_SECRET ?? '';
  if (!appId || !appSecret) throw new WechatJssdkError('wechat_jssdk_not_configured', 503);

  const allowedOrigin = options.allowedOrigin ?? process.env.WECHAT_JSSDK_ALLOWED_ORIGIN ?? DEFAULT_ORIGIN;
  const signedUrl = normalizeWechatJssdkUrl(rawUrl, allowedOrigin);
  const cacheFile = options.cacheFile ?? path.join(
    path.resolve(process.cwd(), process.env.RUNTIME_DIR || 'runtime'),
    'wechat-jssdk-cache.json'
  );
  const now = options.now ?? Date.now;
  const cache = await getValidWechatCredentials({ appId, appSecret, cacheFile, fetchImpl: options.fetchImpl ?? fetch, now });
  if (!cache.jsapiTicket) throw new WechatJssdkError('wechat_jsapi_ticket_unavailable', 502);

  const timestamp = Math.floor(now() / 1000);
  const nonceStr = options.nonce?.() ?? randomBytes(16).toString('hex');
  return {
    appId,
    timestamp,
    nonceStr,
    signature: createWechatJssdkSignature(cache.jsapiTicket, nonceStr, timestamp, signedUrl),
    jsApiList: JS_API_LIST
  };
}

export function normalizeWechatJssdkUrl(rawUrl: string, allowedOrigin = DEFAULT_ORIGIN) {
  if (!rawUrl || rawUrl.length > MAX_SIGNED_URL_LENGTH) throw new WechatJssdkError('invalid_wechat_jssdk_url', 400);
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new WechatJssdkError('invalid_wechat_jssdk_url', 400);
  }
  if (parsed.protocol !== 'https:' || parsed.origin !== allowedOrigin || parsed.username || parsed.password) {
    throw new WechatJssdkError('wechat_jssdk_url_not_allowed', 400);
  }
  parsed.hash = '';
  return parsed.toString();
}

export function createWechatJssdkSignature(ticket: string, nonceStr: string, timestamp: number, url: string) {
  const input = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return createHash('sha1').update(input).digest('hex');
}

export class WechatJssdkError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'WechatJssdkError';
  }
}

async function getValidWechatCredentials(options: {
  appId: string;
  appSecret: string;
  cacheFile: string;
  fetchImpl: typeof fetch;
  now: () => number;
}) {
  const existing = await readCache(options.cacheFile);
  const nowMs = options.now();
  if (existing.jsapiTicket && (existing.jsapiTicketExpiresAt ?? 0) > nowMs) return existing;

  const pending = refreshes.get(options.cacheFile);
  if (pending) return pending;
  const refresh = refreshCredentials(existing, options).finally(() => refreshes.delete(options.cacheFile));
  refreshes.set(options.cacheFile, refresh);
  return refresh;
}

async function refreshCredentials(
  existing: WechatCredentialCache,
  options: { appId: string; appSecret: string; cacheFile: string; fetchImpl: typeof fetch; now: () => number }
) {
  const nowMs = options.now();
  let accessToken = existing.accessToken;
  let accessTokenExpiresAt = existing.accessTokenExpiresAt ?? 0;
  if (!accessToken || accessTokenExpiresAt <= nowMs) {
    const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/stable_token');
    const tokenResponse = await options.fetchImpl(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credential', appid: options.appId, secret: options.appSecret, force_refresh: false })
    });
    const tokenData = await parseWechatResponse(tokenResponse, 'wechat_access_token_failed');
    if (!tokenData.access_token) throw new WechatJssdkError('wechat_access_token_missing', 502);
    accessToken = tokenData.access_token;
    accessTokenExpiresAt = safeExpiry(nowMs, tokenData.expires_in);
  }

  const ticketUrl = new URL('https://api.weixin.qq.com/cgi-bin/ticket/getticket');
  ticketUrl.searchParams.set('access_token', accessToken);
  ticketUrl.searchParams.set('type', 'jsapi');
  const ticketResponse = await options.fetchImpl(ticketUrl);
  const ticketData = await parseWechatResponse(ticketResponse, 'wechat_jsapi_ticket_failed');
  if (!ticketData.ticket) throw new WechatJssdkError('wechat_jsapi_ticket_missing', 502);

  const cache: WechatCredentialCache = {
    accessToken,
    accessTokenExpiresAt,
    jsapiTicket: ticketData.ticket,
    jsapiTicketExpiresAt: safeExpiry(nowMs, ticketData.expires_in)
  };
  await writeCache(options.cacheFile, cache);
  return cache;
}

async function parseWechatResponse(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as WechatApiResponse | null;
  if (!response.ok || !data || (data.errcode ?? 0) !== 0) throw new WechatJssdkError(fallback, 502);
  return data;
}

function safeExpiry(nowMs: number, expiresIn = 7200) {
  const safeSeconds = Math.max(60, expiresIn - REFRESH_WINDOW_SECONDS);
  return nowMs + safeSeconds * 1000;
}

async function readCache(cacheFile: string) {
  const memory = memoryCaches.get(cacheFile);
  if (memory) return memory;
  try {
    const parsed = JSON.parse(await readFile(cacheFile, 'utf8')) as WechatCredentialCache;
    memoryCaches.set(cacheFile, parsed);
    return parsed;
  } catch {
    return {};
  }
}

async function writeCache(cacheFile: string, cache: WechatCredentialCache) {
  await mkdir(path.dirname(cacheFile), { recursive: true });
  const temporary = `${cacheFile}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(cache)}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, cacheFile);
  await chmod(cacheFile, 0o600);
  memoryCaches.set(cacheFile, cache);
}
