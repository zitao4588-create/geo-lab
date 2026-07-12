import type { BusinessType, DiagnosisInput, PageAuditResult, PageAuditTarget } from '../shared/types.js';

interface AuditSpec {
  id: string;
  name: string;
  path: string;
  requiredFacts: string[];
  kind: 'html' | 'text' | 'xml';
}

const discoverySpecs: AuditSpec[] = [
  { id: 'privacy', name: '隐私政策页', path: '/privacy/', requiredFacts: ['privacy', 'data'], kind: 'html' },
  { id: 'features', name: '功能说明页', path: '/features/', requiredFacts: ['feature', 'category'], kind: 'html' },
  { id: 'faq', name: 'FAQ/常见问题', path: '/faq/', requiredFacts: ['faq', 'privacy'], kind: 'html' },
  { id: 'geo-case', name: 'GEO 自证案例', path: '/geo-case/', requiredFacts: ['geo', 'brand'], kind: 'html' },
  { id: 'robots', name: 'robots.txt', path: '/robots.txt', requiredFacts: ['sitemap'], kind: 'text' },
  { id: 'sitemap', name: 'sitemap.xml', path: '/sitemap.xml', requiredFacts: ['home', 'privacy', 'faq'], kind: 'xml' },
  { id: 'llms', name: 'llms.txt', path: '/llms.txt', requiredFacts: ['brand', 'category', 'privacy'], kind: 'text' }
];

export async function auditSubmittedPages(input: DiagnosisInput): Promise<PageAuditResult> {
  const submittedUrls = extractSubmittedUrls(input.links ?? '');
  const generatedAt = new Date().toISOString();

  if (submittedUrls.length === 0) {
    return {
      generatedAt,
      score: 0,
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
  const targets = await Promise.all([
    auditSubmittedUrl(submittedUrl, input),
    ...discoverySpecs.map((spec) => auditDiscoveredUrl(baseUrl, spec, facts))
  ]);
  const summary = summarizeTargets(targets);

  return {
    baseUrl,
    generatedAt,
    score: scoreTargets(targets),
    targets,
    summary
  };
}

async function auditSubmittedUrl(url: string, input: DiagnosisInput): Promise<PageAuditTarget> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetchWithTimeout(url, 8_000);
    const contentType = response.headers.get('content-type') ?? '';
    const html = await response.text();
    const visibleText = normalizeText(htmlToText(html));
    const title = extractTitle(html);
    const description = extractMetaDescription(html);
    const canonicalUrl = extractCanonical(html, url);
    const sourceRelation = determineSourceRelation(input, title, description);
    const businessType = inferBusinessType(input);
    const scopeRelation = determineScopeRelation(input, businessType, url, visibleText, sourceRelation);
    const { matchedFacts, missingFacts } = buildSubmittedFacts(input, businessType, url, title, description, visibleText, sourceRelation);
    const okHttp = response.status >= 200 && response.status < 300;
    const status = !okHttp
      ? 'missing'
      : sourceRelation === 'entity_matched' && scopeRelation === 'matched' && missingFacts.length === 0
        ? 'ok'
        : 'warn';
    const notes = [
      `HTTP ${response.status}`,
      sourceRelation === 'entity_matched' ? '页面内容与目标实体匹配。' : sourceRelation === 'unrelated' ? '页面内容与目标实体不匹配。' : '页面与目标实体的关系无法确认。',
      scopeNote(scopeRelation),
      ...(matchedFacts.length > 0 ? [`命中事实：${matchedFacts.join('、')}`] : []),
      ...(missingFacts.length > 0 ? [`缺少事实：${missingFacts.join('、')}`] : [])
    ];

    return {
      id: 'submitted',
      name: '用户提交入口',
      url,
      status,
      httpStatus: response.status,
      contentType,
      title,
      description,
      canonicalUrl,
      matchedFacts,
      missingFacts,
      notes,
      fetchedAt,
      evidenceLabel: okHttp ? 'verified_external' : 'suggested_supplement',
      sourceRelation,
      scopeRelation,
      submitted: true
    };
  } catch (error) {
    return {
      id: 'submitted',
      name: '用户提交入口',
      url,
      status: 'failed',
      matchedFacts: [],
      missingFacts: ['页面可访问性', '实体关系', '业务范围'],
      notes: [error instanceof Error ? safeError(error.message) : '抓取失败'],
      fetchedAt,
      evidenceLabel: 'suggested_supplement',
      sourceRelation: 'unknown',
      scopeRelation: 'unknown',
      submitted: true
    };
  }
}

async function auditDiscoveredUrl(baseUrl: string, spec: AuditSpec, facts: Record<string, string[]>): Promise<PageAuditTarget> {
  const url = new URL(spec.path, baseUrl).toString();
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetchWithTimeout(url, 8_000);
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    const visibleText = normalizeText(spec.kind === 'html' ? htmlToText(text) : text);
    const title = spec.kind === 'html' ? extractTitle(text) : undefined;
    const description = spec.kind === 'html' ? extractMetaDescription(text) : undefined;
    const matchedFacts = findMatchedFacts(visibleText, spec.requiredFacts, facts);
    const missingFacts = spec.requiredFacts.filter((fact) => !matchedFacts.includes(fact));
    const okHttp = response.status >= 200 && response.status < 300;
    const status = !okHttp ? 'missing' : missingFacts.length === 0 ? 'ok' : 'warn';
    const notes = buildNotes(spec, response.status, matchedFacts, missingFacts);

    return {
      id: spec.id,
      name: spec.name,
      url,
      status,
      httpStatus: response.status,
      contentType,
      title,
      description,
      matchedFacts,
      missingFacts,
      notes,
      fetchedAt,
      evidenceLabel: okHttp ? 'verified_external' : 'suggested_supplement',
      sourceRelation: status === 'ok' ? 'entity_matched' : 'unknown',
      scopeRelation: status === 'ok' ? 'matched' : 'unknown'
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
      scopeRelation: 'unknown'
    };
  }
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

function inferBusinessType(input: DiagnosisInput): BusinessType {
  if (input.confirmedBusinessType) return input.confirmedBusinessType;
  const combined = `${input.businessName} ${input.description} ${input.industry}`;
  if (/门店|餐厅|酒店|诊所|工作室|本地服务|到店|商家/u.test(combined)) return 'local_service';
  if (/小程序|软件|应用|App|平台|SaaS|网站|数字工具|管理工具/u.test(combined)) return 'software_or_miniprogram';
  if (/剃须刀|商品|产品|设备|电器|刀头|马达|硬件/u.test(combined)) return 'physical_product';
  return 'generic_or_unknown';
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
  if (pageNormalized.includes(normalizeIdentity(input.businessName)) || submittedNormalized.includes(pageNormalized)) return 'entity_matched';

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
    const city = normalizeText(input.city);
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
    if (visibleText.includes(normalizeText(input.industry)) || /剃须刀|刀头|马达|电器|商品/u.test(visibleText)) matchedFacts.push('category');
    const models = extractPrimaryModels(`${url} ${title ?? ''} ${description ?? ''}`);
    if (models.length > 0) matchedFacts.push('model', ...models);
  } else if (businessType === 'local_service') {
    requiredFacts.push('entry', input.city);
    if (/store|shop|location|门店|餐厅|预约|排队/iu.test(`${new URL(url).pathname} ${visibleText}`)) matchedFacts.push('entry');
    if (normalizeText(input.city) && visibleText.includes(normalizeText(input.city))) matchedFacts.push(input.city);
  } else {
    requiredFacts.push('category', 'entry');
    if (visibleText.includes(normalizeText(input.industry)) || /软件|小程序|应用|平台|网站|GEO/iu.test(visibleText)) matchedFacts.push('category');
    if (new URL(url).pathname !== '/' || /使用|入口|功能|产品/u.test(visibleText)) matchedFacts.push('entry');
  }

  return {
    matchedFacts: unique(matchedFacts),
    missingFacts: requiredFacts.filter((fact) => !matchedFacts.includes(fact))
  };
}

function extractPrimaryModels(value: string) {
  return unique((decodeURIComponent(value).match(/\bES-[A-Z0-9]+\b/giu) ?? []).map((model) => model.toUpperCase()));
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
    brand: [input.businessName, '冰箱小雷达', 'Fridge Radar'],
    category: [input.industry, '冰箱食材库存管理', '食材库存', '小程序'],
    entry: ['小程序', '二维码', '微信'],
    privacy: ['隐私', 'privacy', '/privacy/', '个人信息', '不默认上传', 'CloudBase', 'openid', '数据'],
    data: ['食材数据', '云开发', '隔离', '本地', '第三方 AI'],
    feature: ['5 分区', '五分区', '/features/', 'features', '冷藏', '冷冻', '门架', '果蔬', '变温', '开饭雷达', '临期提醒', '到期日历'],
    faq: ['常见问题', 'FAQ', '/faq/', 'faq', '问答', '是否'],
    geo: ['GEO', 'AI', '可见', '自证', '提示词', 'llms.txt'],
    sitemap: ['Sitemap', 'sitemap.xml'],
    home: ['/', 'fridge.playgamelab.cn'],
    features: ['/features'],
    faq_path: ['/faq']
  };
}

function findMatchedFacts(text: string, requiredFacts: string[], facts: Record<string, string[]>) {
  return requiredFacts.filter((fact) => (facts[fact] ?? [fact]).some((keyword) => text.includes(normalizeText(keyword))));
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

function buildNotes(spec: AuditSpec, httpStatus: number, matchedFacts: string[], missingFacts: string[]) {
  const notes = [`HTTP ${httpStatus}`];
  if (matchedFacts.length > 0) notes.push(`命中事实：${matchedFacts.join('、')}`);
  if (missingFacts.length > 0) notes.push(`缺少事实：${missingFacts.join('、')}`);
  return notes;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'AIExposureCheckH5/0.4 (+https://exposure.playgamelab.cn)'
      }
    });
  } finally {
    clearTimeout(timer);
  }
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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/gu, '');
}

function normalizeIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\p{Script=Han}]+/gu, '');
}

function safeError(value: string) {
  return value.slice(0, 180);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
