import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditSubmittedPages } from '../dist/server/server/pageAudit.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(appRoot, 'public');
const definition = /多模型 GEO 实体认知与公开证据诊断工具/u;
const exclusions = /不是医学体检.*身体.*影像.*隐私泄露扫描.*广告投放曝光统计/su;

test('all required public knowledge surfaces exist and use one product definition', async () => {
  const surfaces = [
    ['index.html', path.join(appRoot, 'index.html')],
    ['ai-exposure-check.html', path.join(publicDir, 'ai-exposure-check.html')],
    ['features', path.join(publicDir, 'features', 'index.html')],
    ['faq', path.join(publicDir, 'faq', 'index.html')],
    ['privacy', path.join(publicDir, 'privacy.html')],
    ['llms', path.join(publicDir, 'llms.txt')]
  ];

  for (const [name, filename] of surfaces) {
    const text = await readFile(filename, 'utf8');
    assert.match(text, definition, `${name} is missing the canonical product definition`);
  }

  for (const filename of [path.join(appRoot, 'index.html'), path.join(publicDir, 'ai-exposure-check.html'), path.join(publicDir, 'faq', 'index.html'), path.join(publicDir, 'llms.txt')]) {
    assert.match(await readFile(filename, 'utf8'), exclusions);
  }
});

test('structured data identifies the product and FAQ without unsupported outcome claims', async () => {
  const index = await readFile(path.join(appRoot, 'index.html'), 'utf8');
  const faq = await readFile(path.join(publicDir, 'faq', 'index.html'), 'utf8');
  const indexLd = parseJsonLd(index);
  const faqLd = parseJsonLd(faq);
  assert.ok(indexLd.some((item) => item['@type'] === 'WebApplication' && item.name === 'AI曝光体检'));
  assert.ok(faqLd.some((item) => item['@type'] === 'FAQPage' && item.mainEntity.length >= 6));
  assert.doesNotMatch(`${index}\n${faq}`, /保证.*(?:排名|流量|推荐)|提升\s*\d+%|客户案例证明/u);
});

test('sitemap and machine-readable entry cover the official knowledge surfaces', async () => {
  const sitemap = await readFile(path.join(publicDir, 'sitemap.xml'), 'utf8');
  for (const pathname of ['/', '/ai-exposure-check.html', '/features/', '/faq/', '/geo-case/', '/privacy.html', '/terms.html', '/llms.txt']) {
    assert.match(sitemap, new RegExp(`<loc>https://exposure\\.playgamelab\\.cn${pathname.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}</loc>`, 'u'));
  }
  const llms = await readFile(path.join(publicDir, 'llms.txt'), 'utf8');
  assert.match(llms, /输入.*产品.*公开入口.*行业.*城市.*目标客户/su);
  assert.match(llms, /输出.*实体识别.*自然推荐.*来源可信度.*站点基建/su);
});

test('PageAudit can verify the product definition and all site infrastructure from source files', async () => {
  const routes = {
    'https://exposure.playgamelab.cn/ai-exposure-check.html': await readFile(path.join(publicDir, 'ai-exposure-check.html'), 'utf8'),
    'https://exposure.playgamelab.cn/privacy.html': await readFile(path.join(publicDir, 'privacy.html'), 'utf8'),
    'https://exposure.playgamelab.cn/features/': await readFile(path.join(publicDir, 'features', 'index.html'), 'utf8'),
    'https://exposure.playgamelab.cn/faq/': await readFile(path.join(publicDir, 'faq', 'index.html'), 'utf8'),
    'https://exposure.playgamelab.cn/geo-case/': await readFile(path.join(publicDir, 'geo-case', 'index.html'), 'utf8'),
    'https://exposure.playgamelab.cn/robots.txt': await readFile(path.join(publicDir, 'robots.txt'), 'utf8'),
    'https://exposure.playgamelab.cn/sitemap.xml': await readFile(path.join(publicDir, 'sitemap.xml'), 'utf8'),
    'https://exposure.playgamelab.cn/llms.txt': await readFile(path.join(publicDir, 'llms.txt'), 'utf8')
  };
  await withFetch(routes, async () => {
    const audit = await auditSubmittedPages({
      businessName: 'AI曝光体检',
      description: '面向品牌和产品负责人的多模型 GEO 实体认知与公开证据诊断工具',
      industry: '多模型 GEO 诊断软件',
      city: '全国',
      targetCustomers: '需要核查 AI 实体认知和公开证据边界的品牌与产品负责人',
      links: 'https://exposure.playgamelab.cn/ai-exposure-check.html',
      competitors: '同类 GEO 诊断工具',
      confirmedBusinessType: 'software_or_miniprogram'
    });
    assert.equal(audit.submittedSourceScore, 100);
    assert.equal(audit.siteInfrastructureScore, 100);
    assert.equal(audit.targets.find((target) => target.id === 'submitted')?.status, 'ok');
    assert.equal(audit.summary.ok, 8);
  });
});

function parseJsonLd(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)]
    .map((match) => JSON.parse(match[1]));
}

async function withFetch(routes, action) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    const body = routes[url];
    if (body === undefined) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    const contentType = url.endsWith('.xml') ? 'application/xml' : url.endsWith('.txt') ? 'text/plain' : 'text/html; charset=utf-8';
    return new Response(body, { status: 200, headers: { 'content-type': contentType } });
  };
  try {
    await action();
  } finally {
    globalThis.fetch = original;
  }
}
