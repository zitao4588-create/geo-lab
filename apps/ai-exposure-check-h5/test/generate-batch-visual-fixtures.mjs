import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildFinalGeoReport, buildPromptUniverse } from '../dist/server/server/rules.js';

const runtimeDir = path.resolve(process.env.BATCH_RUNTIME_DIR || '/private/tmp/geo-batch-instance-runtime');
const diagnosisDir = path.join(runtimeDir, 'diagnoses');
await mkdir(diagnosisDir, { recursive: true });

const cases = [
  makeCase('diag_batch_physical_normal', {
    businessName: '松下大锤子2.0剃须刀', description: '官方型号 ES-LM55 的五刀头电动剃须刀', links: 'https://consumer.panasonic.cn/product/ES-LM55.html', industry: '电动剃须刀', city: '全国', targetCustomers: '重视剃净效率和正规售后的成年男性', competitors: '飞利浦S9000', confirmedBusinessType: 'physical_product'
  }, ['松下大锤子2.0剃须刀是官方型号 ES-LM55 的五刀头电动剃须刀。'], okAudit('ES-LM55 五刀头电动剃须刀', ['ES-LM55', '五刀头', '电动剃须刀'])),
  makeCase('diag_batch_software_misread', {
    businessName: '冰箱小雷达', description: '帮助家庭管理冰箱食材库存并提醒临期食品的微信小程序', links: 'https://fridge.playgamelab.cn', industry: '家庭食材库存管理小程序', city: '全国', targetCustomers: '希望减少食材浪费的家庭用户', competitors: '同类库存工具', confirmedBusinessType: 'software_or_miniprogram'
  }, ['冰箱小雷达是一种装在智能冰箱中的雷达传感器硬件。'], okAudit('冰箱小雷达家庭食材库存管理微信小程序', ['微信小程序', '食材库存', '临期提醒'])),
  makeCase('diag_batch_local_boundary', {
    businessName: '海底捞西安门店服务', description: '西安具体门店的餐饮、排队和预约服务', links: 'https://www.haidilao.com/', industry: '火锅餐饮门店服务', city: '西安', targetCustomers: '需要到店用餐和预约的西安顾客', competitors: '本地火锅门店', confirmedBusinessType: 'local_service'
  }, ['海底捞是全国连锁火锅品牌，无法从该全国首页确认西安具体门店范围。'], warnAudit()),
  makeCase('diag_batch_partial_failure', {
    businessName: '覆盖率测试工具', description: '验证部分模型失败时保留成功样本并降低置信度的软件', links: 'https://example.invalid/partial', industry: '模型覆盖率测试软件', city: '全国', targetCustomers: '检查多模型报告可信度的测试人员', competitors: '同类测试工具', confirmedBusinessType: 'software_or_miniprogram'
  }, ['覆盖率测试工具是用于核查多模型报告可信度的软件。'], okAudit('覆盖率测试工具模型覆盖率测试软件', ['覆盖率测试工具', '软件']), true)
];

for (const item of cases) {
  await writeFile(path.join(diagnosisDir, `${item.report.id}.json`), `${JSON.stringify({ input: item.input, report: item.report, savedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({ runtimeDir, reportIds: cases.map((item) => item.report.id) }, null, 2));

function makeCase(id, input, answers, pageAudit, partial = false) {
  input.samplePrompts = [`${input.businessName}是什么？`];
  const prompt = buildPromptUniverse(input)[0];
  const samples = [sample(prompt, 'qwen', answers[0], 'success')];
  const statuses = [{ provider: 'qwen', model: 'controlled-qwen', status: 'sampled', promptCount: 1, successCount: 1, failureCount: 0, note: '本地确定性 fixture' }];
  if (partial) {
    samples.push(sample(prompt, 'doubao', '', 'failed'));
    statuses.push({ provider: 'doubao', model: 'controlled-doubao', status: 'unavailable', promptCount: 1, successCount: 0, failureCount: 1, note: '本地受控超时 fixture' });
  }
  const report = buildFinalGeoReport(input, samples, pageAudit, statuses);
  report.id = id;
  report.evidencePolicy.notes = '本页面来自本地确定性视觉 fixture，不调用真实模型，不代表消费端排名。';
  return { input, report };
}

function sample(prompt, provider, answer, status) {
  return { prompt, provider, model: `controlled-${provider}`, status, sampledAt: new Date().toISOString(), latencyMs: 1, ...(status === 'success' ? { answer } : { error: 'controlled timeout' }) };
}

function okAudit(description, matchedFacts) {
  return { generatedAt: new Date().toISOString(), score: 100, targets: [{ id: 'home', name: '已核验入口', url: 'https://example.invalid/official', status: 'ok', httpStatus: 200, title: description, description, matchedFacts, missingFacts: [], notes: ['本地 ground truth fixture'], fetchedAt: new Date().toISOString(), evidenceLabel: 'verified_external' }], summary: { ok: 1, warn: 0, missing: 0, failed: 0, note: '本地确定性来源 fixture' } };
}

function warnAudit() {
  return { generatedAt: new Date().toISOString(), score: 20, targets: [{ id: 'home', name: '全国品牌首页', url: 'https://www.haidilao.com/', status: 'warn', httpStatus: 200, title: '全国品牌首页', description: '未证明西安具体门店和服务半径', matchedFacts: ['海底捞'], missingFacts: ['西安具体门店', '服务范围'], notes: ['来源范围不匹配'], fetchedAt: new Date().toISOString(), evidenceLabel: 'verified_external' }], summary: { ok: 0, warn: 1, missing: 0, failed: 0, note: '全国首页不能证明具体门店' } };
}
