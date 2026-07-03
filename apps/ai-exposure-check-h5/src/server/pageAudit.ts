import type { DiagnosisInput, PageAuditResult, PageAuditTarget } from '../shared/types.js';

interface AuditSpec {
  id: string;
  name: string;
  path: string;
  requiredFacts: string[];
  kind: 'html' | 'text' | 'xml';
}

const auditSpecs: AuditSpec[] = [
  { id: 'home', name: '品牌首页', path: '/', requiredFacts: ['brand', 'category', 'entry'], kind: 'html' },
  { id: 'privacy', name: '隐私政策页', path: '/privacy/', requiredFacts: ['privacy', 'data'], kind: 'html' },
  { id: 'features', name: '功能说明页', path: '/features/', requiredFacts: ['feature', 'category'], kind: 'html' },
  { id: 'faq', name: 'FAQ/常见问题', path: '/faq/', requiredFacts: ['faq', 'privacy'], kind: 'html' },
  { id: 'geo-case', name: 'GEO 自证案例', path: '/geo-case/', requiredFacts: ['geo', 'brand'], kind: 'html' },
  { id: 'robots', name: 'robots.txt', path: '/robots.txt', requiredFacts: ['sitemap'], kind: 'text' },
  { id: 'sitemap', name: 'sitemap.xml', path: '/sitemap.xml', requiredFacts: ['home', 'privacy', 'faq'], kind: 'xml' },
  { id: 'llms', name: 'llms.txt', path: '/llms.txt', requiredFacts: ['brand', 'category', 'privacy'], kind: 'text' }
];

export async function auditSubmittedPages(input: DiagnosisInput): Promise<PageAuditResult> {
  const baseUrl = inferBaseUrl(input.links ?? '');
  const generatedAt = new Date().toISOString();

  if (!baseUrl) {
    return {
      generatedAt,
      score: 0,
      targets: [],
      summary: {
        ok: 0,
        warn: 0,
        missing: auditSpecs.length,
        failed: 0,
        note: '未提交可审计的公开网址。'
      }
    };
  }

  const facts = buildFactDictionary(input);
  const targets = await Promise.all(auditSpecs.map((spec) => auditOne(baseUrl, spec, facts)));
  const summary = summarizeTargets(targets);

  return {
    baseUrl,
    generatedAt,
    score: scoreTargets(targets),
    targets,
    summary
  };
}

function inferBaseUrl(links: string) {
  const urls = links.match(/https?:\/\/[^\s，,；;]+/giu) ?? [];
  const preferred = urls.find((url) => /fridge\.playgamelab\.cn|playgamelab\.cn/iu.test(url)) ?? urls[0];
  if (!preferred) return undefined;

  try {
    const parsed = new URL(preferred);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
}

async function auditOne(baseUrl: string, spec: AuditSpec, facts: Record<string, string[]>): Promise<PageAuditTarget> {
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
      evidenceLabel: okHttp ? 'verified_external' : 'suggested_supplement'
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
      evidenceLabel: 'suggested_supplement'
    };
  }
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
  if (spec.kind === 'html' && !matchedFacts.includes('brand')) notes.push('建议页面首屏显式出现品牌名和产品定义。');
  return notes;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'AIExposureCheckH5/0.3 (+https://exposure.playgamelab.cn)'
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
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/iu);
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

function safeError(value: string) {
  return value.slice(0, 180);
}
