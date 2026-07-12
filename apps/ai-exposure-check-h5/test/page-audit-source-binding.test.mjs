import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditSubmittedPages } from '../dist/server/server/pageAudit.js';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/page-audit');
const panasonicHtml = await readFile(path.join(fixtureDir, 'panasonic-es-lm55.html'), 'utf8');
const haidilaoHtml = await readFile(path.join(fixtureDir, 'haidilao-store-search.html'), 'utf8');
const weatherHtml = await readFile(path.join(fixtureDir, 'unrelated-weather.html'), 'utf8');

test('audits the submitted Panasonic product URL and binds the official model to the entity', async () => {
  await withFetch(htmlRoutes({
    'https://consumer.panasonic.cn/product/beauty-health/mens-shaver-grooming/shaver/ES-LM55.html': panasonicHtml
  }), async () => {
    const audit = await auditSubmittedPages(physicalInput());
    const submitted = audit.targets.find((target) => target.id === 'submitted');
    assert.equal(submitted?.url, physicalInput().links);
    assert.equal(submitted?.status, 'ok');
    assert.equal(submitted?.sourceRelation, 'entity_matched');
    assert.equal(submitted?.scopeRelation, 'matched');
    assert.ok(submitted?.matchedFacts.includes('ES-LM55'));
  });
});

test('keeps the Panasonic source verified when the submitted model conflicts with the official URL model', async () => {
  await withFetch(htmlRoutes({
    'https://consumer.panasonic.cn/product/beauty-health/mens-shaver-grooming/shaver/ES-LM55.html': panasonicHtml
  }), async () => {
    const audit = await auditSubmittedPages(physicalInput({
      businessName: '松下大锤子剃须刀',
      description: '用户声称官方型号为 ES-LV9C 并有六刀头'
    }));
    const submitted = audit.targets.find((target) => target.id === 'submitted');
    assert.equal(submitted?.status, 'ok');
    assert.ok(submitted?.matchedFacts.includes('ES-LM55'));
    assert.ok(!submitted?.matchedFacts.includes('ES-LV9C'));
  });
});

test('recognizes the official store-search entry but does not claim it proves a Xi’an store', async () => {
  const url = 'https://www.haidilao.com/serve/storeSearch';
  await withFetch(htmlRoutes({ [url]: haidilaoHtml }), async () => {
    const audit = await auditSubmittedPages(localInput({ links: url }));
    const submitted = audit.targets.find((target) => target.id === 'submitted');
    assert.equal(submitted?.sourceRelation, 'entity_matched');
    assert.equal(submitted?.scopeRelation, 'partial');
    assert.equal(submitted?.status, 'warn');
    assert.ok(submitted?.missingFacts.includes('西安'));
  });
});

test('treats a national brand homepage as scope-mismatched for a specific local service', async () => {
  const url = 'https://www.haidilao.com/';
  await withFetch(htmlRoutes({ [url]: haidilaoHtml }), async () => {
    const audit = await auditSubmittedPages(localInput({ links: url }));
    const submitted = audit.targets.find((target) => target.id === 'submitted');
    assert.equal(submitted?.sourceRelation, 'entity_matched');
    assert.equal(submitted?.scopeRelation, 'mismatched');
    assert.equal(submitted?.status, 'warn');
  });
});

test('does not bind an unrelated URL to the submitted entity', async () => {
  const url = 'https://example.com/weather';
  await withFetch(htmlRoutes({ [url]: weatherHtml }), async () => {
    const audit = await auditSubmittedPages({
      businessName: '边界测试工具',
      description: '用于检查品牌实体认知和来源边界的网页软件',
      industry: '安全测试软件',
      city: '全国',
      targetCustomers: '验证证据边界的测试人员',
      links: url,
      competitors: '同类产品',
      confirmedBusinessType: 'software_or_miniprogram'
    });
    const submitted = audit.targets.find((target) => target.id === 'submitted');
    assert.equal(submitted?.sourceRelation, 'unrelated');
    assert.equal(submitted?.scopeRelation, 'mismatched');
    assert.notEqual(submitted?.status, 'ok');
  });
});

function physicalInput(overrides = {}) {
  return {
    businessName: '松下大锤子2.0剃须刀',
    description: '官方型号 ES-LM55 的五刀头电动剃须刀',
    industry: '电动剃须刀',
    city: '全国',
    targetCustomers: '重视剃净效率和正规售后的成年男性',
    links: 'https://consumer.panasonic.cn/product/beauty-health/mens-shaver-grooming/shaver/ES-LM55.html',
    competitors: '同类产品',
    confirmedBusinessType: 'physical_product',
    ...overrides
  };
}

function localInput(overrides = {}) {
  return {
    businessName: '海底捞西安门店服务',
    description: '提供门店餐饮、排队和预约信息的本地餐饮服务',
    industry: '火锅餐饮门店服务',
    city: '西安',
    targetCustomers: '需要到店用餐和预约的西安顾客',
    links: 'https://www.haidilao.com/serve/storeSearch',
    competitors: '同类产品',
    confirmedBusinessType: 'local_service',
    ...overrides
  };
}

function htmlRoutes(routes) {
  return async (input) => {
    const url = String(input);
    const body = routes[url];
    if (body) return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  };
}

async function withFetch(fetchImpl, action) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await action();
  } finally {
    globalThis.fetch = original;
  }
}
