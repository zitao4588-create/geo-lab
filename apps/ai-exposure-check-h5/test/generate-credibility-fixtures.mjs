import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessDiagnosisInput } from '../dist/server/server/credibility.js';
import { buildFinalGeoReport, buildPromptUniverse } from '../dist/server/server/rules.js';
import { renderReportHtml, renderReportMarkdown } from '../dist/server/server/exporter.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/report-credibility-hardening-20260712');
const runtimeDir = process.env.CREDIBILITY_RUNTIME_DIR || path.join('/private/tmp', 'geo-credibility-runtime');
const diagnosisDir = path.join(runtimeDir, 'diagnoses');
const fridgePackagePath = path.join(repoRoot, 'outputs/h5-mvp/fridge-radar-4model-20260711/evidence-package.pretty.json');

await mkdir(outputDir, { recursive: true });
await mkdir(path.join(outputDir, 'screenshots'), { recursive: true });
await mkdir(diagnosisDir, { recursive: true });

const fridgePackage = JSON.parse(await readFile(fridgePackagePath, 'utf8'));
const fridgeReport = buildFinalGeoReport(
  { ...fridgePackage.input, confirmedBusinessType: 'software_or_miniprogram' },
  fridgePackage.samples,
  fridgePackage.pageAudit,
  fridgePackage.providerStatuses
);
fridgeReport.id = 'diag_credibility_fridge';
fridgeReport.exports = undefined;
fridgeReport.evidencePolicy.notes = '本验收报告复用 2026-07-11 已保存的四模型真实 API 样本和页面审计，不发起新调用；API 样本不等于消费端排名。';

const panasonicInput = {
  businessName: '松下大锤子剃须刀',
  description: '松下大锤子2.0五刀头电动剃须刀，官方型号 ES-LM55',
  links: 'https://consumer.panasonic.cn/product/beauty-health/mens-shaver-grooming/shaver/ES-LM55.html',
  industry: '电动剃须刀',
  city: '全国',
  targetCustomers: '胡须粗硬、重视剃净效率和正规售后的成年男性',
  competitors: '飞利浦S9000,博朗9系',
  confirmedBusinessType: 'physical_product'
};
const panasonicPrompts = buildPromptUniverse(panasonicInput);
const providers = ['deepseek', 'hy3', 'qwen', 'doubao'];
const panasonicAnswers = {
  deepseek: '我不确定“大锤子”具体对应哪款松下剃须刀，可能是 ES-LV 系列昵称，建议查看官方型号。',
  hy3: '松下大锤子剃须刀可能是某款高端往复式产品，但我无法准确确认型号。',
  qwen: '松下大锤子2.0剃须刀的官方型号是 ES-LM55，是五刀头磁悬浮马达电动剃须刀。',
  doubao: '松下大锤子剃须刀通常指 ES-LV9C 高端五刀头产品。'
};
const panasonicSamples = providers.flatMap((provider) => panasonicPrompts.map((prompt, index) => ({
  prompt,
  provider,
  model: `controlled-${provider}`,
  status: 'success',
  sampledAt: new Date().toISOString(),
  latencyMs: 1,
  answer: index === 0
    ? panasonicAnswers[provider]
    : prompt.prompt.includes('怎么选') || prompt.prompt.includes('适合')
      ? '选择电动剃须刀要看刀头、马达、防水、续航、耗材和售后，具体型号应以官方资料为准。'
      : `${panasonicAnswers[provider]} 还应核对安全标准、耗材和正规购买渠道。`
})));
const panasonicProviderStatuses = providers.map((provider) => ({
  provider,
  model: `controlled-${provider}`,
  status: 'sampled',
  promptCount: panasonicPrompts.length,
  successCount: panasonicPrompts.length,
  failureCount: 0,
  note: '本地确定性 fixture，不调用真实模型。'
}));
const panasonicAudit = {
  baseUrl: 'https://consumer.panasonic.cn/',
  generatedAt: new Date().toISOString(),
  score: 100,
  targets: [{
    id: 'home',
    name: '松下官方产品页',
    url: panasonicInput.links,
    status: 'ok',
    httpStatus: 200,
    contentType: 'text/html',
    title: '松下大锤子2.0剃须刀 ES-LM55',
    description: '进口旗舰五刀头、超高速磁悬浮马达、IPX7 防水',
    matchedFacts: ['ES-LM55', '五刀头', '磁悬浮马达', '电动剃须刀'],
    missingFacts: [],
    notes: ['官方 ground truth fixture'],
    fetchedAt: new Date().toISOString(),
    evidenceLabel: 'verified_external'
  }],
  summary: { ok: 1, warn: 0, missing: 0, failed: 0, note: '官方产品页已核验。' }
};
const panasonicReport = buildFinalGeoReport(panasonicInput, panasonicSamples, panasonicAudit, panasonicProviderStatuses);
panasonicReport.id = 'diag_credibility_panasonic';
panasonicReport.exports = undefined;
panasonicReport.evidencePolicy.notes = '本验收报告使用本地确定性 fixture 和已核验官方产品事实，不调用真实模型，不代表消费端排名。';

const fictitiousInput = {
  businessName: '月球牌量子胡须雷达',
  description: '神奇产品',
  links: '',
  industry: '产品',
  city: '全国',
  targetCustomers: '所有人',
  competitors: ''
};
const fictitiousAssessment = assessDiagnosisInput(fictitiousInput);

await saveFixture(fridgeReport, fridgePackage.input);
await saveFixture(panasonicReport, panasonicInput);

const benchmark = {
  generatedAt: new Date().toISOString(),
  paidCalls: 0,
  cases: {
    panasonic: summarize(panasonicReport),
    fridgeRadar: summarize(fridgeReport),
    fictitious: { preflight: fictitiousAssessment, fullSamplingBlocked: fictitiousAssessment.status !== 'ready' }
  }
};
await writeFile(path.join(outputDir, 'benchmark-results.json'), `${JSON.stringify(benchmark, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'panasonic-report.md'), renderReportMarkdown(panasonicReport), 'utf8');
await writeFile(path.join(outputDir, 'panasonic-report.html'), renderReportHtml(panasonicReport), 'utf8');
await writeFile(path.join(outputDir, 'fridge-radar-report.md'), renderReportMarkdown(fridgeReport), 'utf8');
await writeFile(path.join(outputDir, 'fridge-radar-report.html'), renderReportHtml(fridgeReport), 'utf8');
await writeFile(path.join(outputDir, 'before-after-report.md'), buildBeforeAfter(fridgeReport, panasonicReport, fictitiousAssessment), 'utf8');
await writeFile(path.join(outputDir, 'fridge-radar-next-content-actions.md'), buildFridgeActions(fridgeReport), 'utf8');

console.log(JSON.stringify({ outputDir, runtimeDir, reports: [fridgeReport.id, panasonicReport.id] }, null, 2));

async function saveFixture(report, input) {
  await writeFile(path.join(diagnosisDir, `${report.id}.json`), `${JSON.stringify({ input, report, savedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}

function summarize(report) {
  return {
    reportId: report.id,
    scoreStatus: report.stages.credibility.scoreStatus,
    confidence: report.stages.credibility.confidence,
    infrastructureAudit: report.stages.infrastructure.pageAudit.targets.length ? report.stages.infrastructure.pageAudit.score : null,
    stringMentionRate: report.stages.credibility.stringMentionRate,
    correctEntityRecognitionRate: report.stages.credibility.correctEntityRecognitionRate,
    naturalRecommendationRate: report.stages.credibility.naturalRecommendationRate,
    misrecognitionRate: report.stages.credibility.misrecognitionRate,
    providerAgreementRate: report.stages.credibility.providerAgreementRate,
    modelConflictCount: report.stages.credibility.modelConflicts.length
  };
}

function buildBeforeAfter(fridge, panasonic, fictitious) {
  return `# 报告可信度加固前后对比

## 修复前

- 品牌字符串复述被当作 AI 可见度。
- 冰箱小雷达 50% 字符串提及被包装成较好的整体认知，但人工复核正确实体识别和无品牌词推荐均接近零。
- 未提交 URL 时摘要显示页面审计 0/100，导出页头却显示基建维度 20/100。
- 实体剃须刀收到微信、隐私、数据上传、拍照、支付和小程序入口模板建议。
- 模型之间的型号冲突未单独呈现。

## 修复后

- 字符串出现、正确实体识别、无品牌词推荐、错误认知和模型一致度分开呈现。
- 低证据输入在模型调用和限额消耗前被预检拦截。
- 没有可审计 URL 时统一显示“未检测”，且暂停总分。
- 实体商品使用型号、规格、安全、售后、耗材和正规渠道问题模板。
- H5、Markdown、HTML 和 evidence package 共享同一可信度结构。

## 固定样本

- 松下：${JSON.stringify(summarize(panasonic))}
- 冰箱小雷达：${JSON.stringify(summarize(fridge))}
- 虚构品牌预检：${fictitious.status}，${fictitious.requiredActions.join('；')}
`;
}

function buildFridgeActions(report) {
  return `# 冰箱小雷达下一轮内容行动清单

本清单来自已保存的 2026-07-11 四模型证据，不包含新付费采样，也不修改冰箱小雷达产品仓库或线上站点。

## 当前事实

- 公开页面审计：${report.stages.infrastructure.pageAudit.score}/100。
- 字符串出现率：${percent(report.stages.credibility.stringMentionRate)}。
- 正确实体识别率：${report.stages.credibility.correctEntityRecognitionRate == null ? '无法判断' : percent(report.stages.credibility.correctEntityRecognitionRate)}。
- 无品牌词自然推荐率：${percent(report.stages.credibility.naturalRecommendationRate)}。
- 错误认知率：${percent(report.stages.credibility.misrecognitionRate)}。

## P0 统一实体定义

- 首页、FAQ、功能页和 llms.txt 统一使用一句定义：冰箱小雷达是“微信里的家庭食材库存与临期提醒小程序”，不是冰箱硬件、雷达传感器或自动识别真实用量的设备。
- 在首屏和 FAQ 同时写明：记录需要用户确认；系统不会凭空知道真实消耗。

## P1 覆盖无品牌词场景

- 家里食材总忘记过期怎么办？
- 如何记录家庭冰箱库存？
- 冷藏、冷冻和门架食材怎么分区管理？
- 今晚做饭前怎么快速判断家里已有食材？

每个页面都应给出直接答案、适用人群、操作步骤、能力边界和可核验入口，不只重复品牌名。

## P1 常见误解

- 不是智能冰箱硬件。
- 不是雷达传感器。
- 不会自动识别真实消耗量。
- “开饭雷达”是本地库存辅助判断，不是医学、营养或 AI 自动决策。

## P2 月度复测

- 固定记录正确实体识别、无品牌词推荐、错误认知和模型分歧。
- 不再把字符串出现率作为核心成功指标。
`;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}
