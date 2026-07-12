import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildFinalGeoReport, buildPromptUniverse } from '../dist/server/server/rules.js';

const runtimeDir = path.resolve(process.env.SOURCE_RECOGNITION_RUNTIME_DIR || '/private/tmp/source-recognition-hardening-runtime');
const diagnosisDir = path.join(runtimeDir, 'diagnoses');
await mkdir(diagnosisDir, { recursive: true });

const cases = [
  makeCase('diag_source_p01', productInput(), '松下大锤子2.0是 ES-LM55 电动剃须刀，采用五刀头和磁悬浮马达。', matchedProductAudit()),
  makeCase('diag_source_p02', productInput({ businessName: '松下大锤子剃须刀', description: '用户填写型号 ES-LV9C 的五刀头电动剃须刀' }), '该产品型号是 ES-LV9C，是五刀头电动剃须刀。', matchedProductAudit()),
  makeCase('diag_source_l01', localInput({ links: 'https://www.haidilao.com/serve/storeSearch' }), '海底捞提供门店查询入口，但无法从当前页面确认西安具体门店。', partialLocalAudit()),
  makeCase('diag_source_l03', localInput({ links: 'https://www.haidilao.com/', description: '西安具体门店的餐饮、排队和预约服务' }), '海底捞是全国连锁火锅品牌，当前首页不能证明西安具体门店。', mismatchedLocalAudit()),
  makeCase('diag_source_e02', softwareInput(), '边界测试工具是一款安全测试软件。', unrelatedAudit()),
  makeCase('diag_source_l04', unsupportedLocalInput(), '安心家政提供家庭保洁服务。', unrelatedAudit())
];

for (const item of cases) {
  await writeFile(path.join(diagnosisDir, `${item.report.id}.json`), `${JSON.stringify({ input: item.input, report: item.report, savedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({ runtimeDir, reportIds: cases.map((item) => item.report.id) }, null, 2));

function makeCase(id, input, answer, pageAudit) {
  input.samplePrompts = [`${input.businessName}是什么？`];
  const prompt = buildPromptUniverse(input)[0];
  const samples = [{ prompt, provider: 'qwen', model: 'controlled-qwen', status: 'success', sampledAt: new Date().toISOString(), latencyMs: 1, answer }];
  const providers = [{ provider: 'qwen', model: 'controlled-qwen', status: 'sampled', promptCount: 1, successCount: 1, failureCount: 0, note: '本地确定性 fixture' }];
  const report = buildFinalGeoReport(input, samples, pageAudit, providers);
  report.id = id;
  report.evidencePolicy.notes = '本页面来自本地确定性视觉 fixture，不调用真实模型，不代表消费端排名。';
  return { input, report };
}

function productInput(overrides = {}) {
  return {
    businessName: '松下大锤子2.0剃须刀', description: '官方型号 ES-LM55 的五刀头电动剃须刀',
    links: 'https://consumer.panasonic.cn/product/beauty-health/mens-shaver-grooming/shaver/ES-LM55.html',
    industry: '电动剃须刀', city: '全国', targetCustomers: '重视剃净效率和正规售后的成年男性', competitors: '同类产品', confirmedBusinessType: 'physical_product', ...overrides
  };
}

function localInput(overrides = {}) {
  return {
    businessName: '海底捞西安门店服务', description: '提供门店餐饮、排队和预约信息的本地餐饮服务',
    links: 'https://www.haidilao.com/serve/storeSearch', industry: '火锅餐饮门店服务', city: '西安',
    targetCustomers: '需要到店用餐和预约的西安顾客', competitors: '同类产品', confirmedBusinessType: 'local_service', ...overrides
  };
}

function softwareInput() {
  return {
    businessName: '边界测试工具', description: '用于检查品牌实体认知和来源边界的网页软件', links: 'https://example.com/weather',
    industry: '安全测试软件', city: '全国', targetCustomers: '验证证据边界的测试人员', competitors: '同类产品', confirmedBusinessType: 'software_or_miniprogram'
  };
}

function unsupportedLocalInput() {
  return {
    businessName: '安心家政', description: '宣称百分百除菌、全城最低价并保证绝对安全的家庭保洁服务', links: 'https://example.invalid/anjia',
    industry: '本地家庭保洁服务', city: '西安', targetCustomers: '需要家庭保洁的城市住户', competitors: '同类产品', confirmedBusinessType: 'local_service'
  };
}

function matchedProductAudit() {
  return auditTarget({ status: 'ok', score: 100, sourceRelation: 'entity_matched', scopeRelation: 'matched', title: '松下大锤子剃须刀 LM55', matchedFacts: ['brand', 'category', 'model', 'ES-LM55'], missingFacts: [] });
}

function partialLocalAudit() {
  return auditTarget({ status: 'warn', score: 7, sourceRelation: 'entity_matched', scopeRelation: 'partial', title: '海底捞', matchedFacts: ['brand', 'entry'], missingFacts: ['西安'] });
}

function mismatchedLocalAudit() {
  return auditTarget({ status: 'warn', score: 7, sourceRelation: 'entity_matched', scopeRelation: 'mismatched', title: '海底捞', matchedFacts: ['brand'], missingFacts: ['entry', '西安'] });
}

function unrelatedAudit() {
  return auditTarget({ status: 'warn', score: 7, sourceRelation: 'unrelated', scopeRelation: 'mismatched', title: '无关页面', matchedFacts: [], missingFacts: ['brand', 'category', 'entry'] });
}

function auditTarget({ status, score, sourceRelation, scopeRelation, title, matchedFacts, missingFacts }) {
  const submittedSourceScore = sourceRelation === 'entity_matched' && scopeRelation === 'matched'
    ? 100
    : sourceRelation === 'entity_matched' && scopeRelation === 'partial'
      ? 60
      : sourceRelation === 'entity_matched'
        ? 30
        : 0;
  return {
    generatedAt: new Date().toISOString(), score, submittedSourceScore, siteInfrastructureScore: 0,
    targets: [{
      id: 'submitted', name: '用户提交入口', url: 'https://example.invalid/fixture', status, httpStatus: 200, title, description: '',
      matchedFacts, missingFacts, notes: [`source=${sourceRelation}`, `scope=${scopeRelation}`], fetchedAt: new Date().toISOString(),
      evidenceLabel: 'verified_external', sourceRelation, scopeRelation, submitted: true,
      finalUrl: 'https://example.invalid/fixture', canonicalUrl: 'https://example.invalid/canonical-fixture',
      contentHash: 'a'.repeat(64), matchedEvidence: matchedFacts.map((fact) => ({ fact, snippet: `fixture:${fact}` })),
      freshness: scopeRelation === 'partial' ? 'possibly_stale' : 'current', renderMode: scopeRelation === 'partial' ? 'controlled_dynamic' : 'static'
    }],
    summary: { ok: status === 'ok' ? 1 : 0, warn: status === 'warn' ? 1 : 0, missing: 0, failed: 0, note: '本地来源关系 fixture' }
  };
}
