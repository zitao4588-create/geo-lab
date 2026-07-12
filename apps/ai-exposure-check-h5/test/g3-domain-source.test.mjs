import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildPromptUniverse } from '../dist/server/server/rules.js';
import { auditSubmittedPages, validateAuditUrl } from '../dist/server/server/pageAudit.js';
import { buildSourceCandidates } from '../dist/server/server/sourceCandidates.js';

const promptCases = [
  {
    name: '实体商品围绕型号规格安全渠道耗材保修且不绑定剃须刀',
    input: inputFor('physical_product'),
    required: [/主型号/u, /规格/u, /安全标准/u, /购买渠道/u, /耗材/u, /保修/u, /同口径/u],
    forbidden: [/胡须|刀头|微信|排队|预约|隐私和数据/u]
  },
  {
    name: '软件围绕功能输入输出隐私主体人群限制替代方案',
    input: inputFor('software_or_miniprogram'),
    required: [/功能/u, /输入.*输出/su, /隐私/u, /主体/u, /适用/u, /限制/u, /替代/u],
    forbidden: [/胡须|刀头|排队|停车|保修/u]
  },
  {
    name: '本地服务围绕距离门店时间排队预约服务价格停车儿童',
    input: inputFor('local_service'),
    required: [/距离/u, /门店/u, /营业时间/u, /排队/u, /预约/u, /服务范围/u, /价格/u, /停车/u, /儿童/u],
    forbidden: [/加盟|企业采购|合同|刀头|微信生态/u]
  }
];

for (const item of promptCases) {
  test(item.name, () => {
    const text = buildPromptUniverse(item.input).map((entry) => entry.prompt).join('\n');
    for (const pattern of item.required) assert.match(text, pattern);
    for (const pattern of item.forbidden) assert.doesNotMatch(text, pattern);
  });
}

test('URL validation rejects literal and resolved private addresses before fetch', async () => {
  await assert.rejects(() => validateAuditUrl('http://127.0.0.1/admin'), /private_or_reserved_address/u);
  await assert.rejects(() => validateAuditUrl('http://[::ffff:127.0.0.1]/admin'), /private_or_reserved_address/u);
  await assert.rejects(() => validateAuditUrl('http://public.example/path', {
    resolveHostname: async () => ['10.0.0.8']
  }), /private_or_reserved_address/u);
});

test('redirect to private address and DNS rebinding fail closed without fetching private URL', async () => {
  const fetched = [];
  const routes = new Map([
    ['https://public.example/start', new Response('', { status: 302, headers: { location: 'http://192.168.1.9/secret' } })]
  ]);
  const redirectAudit = await auditSubmittedPages(inputFor('software_or_miniprogram', { links: 'https://public.example/start' }), {
    fetchImpl: async (url) => {
      fetched.push(String(url));
      return routes.get(String(url)) ?? new Response('not found', { status: 404 });
    },
    resolveHostname: async (hostname) => hostname === 'public.example' ? ['93.184.216.34'] : ['192.168.1.9']
  });
  assert.match(redirectAudit.targets[0].notes.join(' '), /private_or_reserved_address/u);
  assert.equal(fetched[0], 'https://public.example/start');
  assert.ok(fetched.every((url) => !url.includes('192.168.1.9')));

  let lookups = 0;
  await assert.rejects(() => validateAuditUrl('https://rebind.example/', {
    resolveHostname: async () => (++lookups === 1 ? ['93.184.216.34'] : ['10.0.0.9']),
    recheck: true
  }), /dns_rebinding_or_private_address/u);
});

test('oversize, wrong MIME, timeout, and redirect loops are rejected deterministically', async () => {
  const baseInput = inputFor('software_or_miniprogram', { links: 'https://public.example/start' });
  const resolver = async () => ['93.184.216.34'];
  const cases = [
    [async () => new Response('x', { status: 200, headers: { 'content-type': 'application/octet-stream' } }), /unsupported_content_type/u],
    [async () => new Response('x', { status: 200, headers: { 'content-type': 'text/html', 'content-length': '2000001' } }), /response_too_large/u],
    [async (_url, init) => { init.signal.throwIfAborted(); throw new DOMException('timed out', 'AbortError'); }, /fetch_timeout/u],
    [async (url) => new Response('', { status: 302, headers: { location: String(url) } }), /redirect_loop/u]
  ];
  for (const [fetchImpl, pattern] of cases) {
    const audit = await auditSubmittedPages(baseInput, { fetchImpl, resolveHostname: resolver, timeoutMs: 5, maxBytes: 1_000_000, maxRedirects: 2 });
    assert.match(audit.targets[0].notes.join(' '), pattern);
  }
});

test('dynamic renderer is controlled, records provenance, and does not upgrade local scope without city evidence', async () => {
  let renderCalls = 0;
  const url = 'https://public.example/store';
  const audit = await auditSubmittedPages(inputFor('local_service', { links: url }), {
    fetchImpl: async (target) => String(target) === url
      ? new Response('<!doctype html><html><head><title>安心家政门店</title></head><body><div id="app"></div><script src="app.js"></script></body></html>', { status: 200, headers: { 'content-type': 'text/html' } })
      : new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } }),
    resolveHostname: async () => ['93.184.216.34'],
    renderPage: async () => {
      renderCalls += 1;
      return '<html><head><title>安心家政门店</title><link rel="canonical" href="https://public.example/store"></head><body>门店 家庭保洁 预约 营业时间</body></html>';
    }
  });
  const submitted = audit.targets[0];
  assert.equal(renderCalls, 1);
  assert.equal(submitted.renderMode, 'controlled_dynamic');
  assert.equal(submitted.scopeRelation, 'partial');
  assert.match(submitted.contentHash, /^[a-f0-9]{64}$/u);
  assert.ok(submitted.matchedEvidence.some((item) => item.fact === 'brand' && item.snippet.includes('安心家政')));
  assert.equal(submitted.freshness, 'current');
});

test('H5 source detail uses the same scope, freshness, render-mode, canonical, and hash fields', async () => {
  const source = await readFile(new URL('../src/client/App.tsx', import.meta.url), 'utf8');
  for (const field of ['scopeRelation', 'freshness', 'renderMode', 'canonicalUrl', 'contentHash']) assert.match(source, new RegExp(`target\\.${field}`, 'u'));
});

test('local source candidates remain pending review and never become verified automatically', () => {
  const candidates = buildSourceCandidates(inputFor('software_or_miniprogram', {
    links: 'https://public.example/app\nhttps://docs.public.example/product'
  }));
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every((item) => item.reviewStatus === 'pending_review'));
  assert.ok(candidates.every((item) => item.discoveryMethod === 'user_submitted'));
  assert.ok(candidates.every((item) => item.verified === false));
});

function inputFor(type, overrides = {}) {
  const common = {
    competitors: '同类产品', confirmedBusinessType: type,
    ...overrides
  };
  if (type === 'physical_product') return { businessName: '清风 X1 空气净化器', description: 'X1 家用空气净化器', industry: '空气净化器', city: '全国', targetCustomers: '关注室内空气质量的家庭', links: 'https://public.example/x1', ...common };
  if (type === 'local_service') return { businessName: '安心家政西安门店', description: '西安家庭保洁与预约服务', industry: '家庭保洁服务', city: '西安', targetCustomers: '需要到店或上门服务的西安家庭', links: 'https://public.example/store', ...common };
  return { businessName: '清单助手', description: '帮助团队整理任务输入并导出结果的网页软件', industry: '任务管理软件', city: '全国', targetCustomers: '需要协作清单的产品团队', links: 'https://public.example/app', ...common };
}
