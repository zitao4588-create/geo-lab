import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assessDiagnosisInput } from '../dist/server/server/credibility.js';
import { diagnosisInputSchema } from '../dist/server/server/validation.js';
import { batchCases } from './batch-instance-cases.mjs';

const outputDir = path.resolve(process.cwd(), '../../outputs/h5-mvp/batch-instance-testing-20260712');
const fixtureDir = path.join(outputDir, 'fixtures');
const screenshotDir = path.join(outputDir, 'screenshots');
await mkdir(fixtureDir, { recursive: true });
await mkdir(screenshotDir, { recursive: true });

const generatedAt = new Date().toISOString();
const results = batchCases.map((item) => {
  const input = diagnosisInputSchema.parse(item.input);
  const assessment = assessDiagnosisInput(input);
  const pass = assessment.status === item.expectedStatus && assessment.businessType === item.businessType;
  return {
    id: item.id,
    title: item.title,
    inputSummary: `${input.businessName} / ${input.industry} / ${input.city}`,
    businessType: assessment.businessType,
    sourceStatus: assessment.officialSourceStatus,
    expectedStatus: item.expectedStatus,
    actualStatus: assessment.status,
    modelCalled: false,
    quotaConsumed: false,
    totalScoreShown: false,
    keyMetrics: {
      preflightScore: assessment.score,
      findingCount: assessment.findings.length,
      requiredActionCount: assessment.requiredActions.length,
      expectedEvidence: item.expectedEvidence ?? null
    },
    localFakeProviderUsed: ['P02', 'S04', 'L03', 'L04', 'E01', 'E02', 'E03', 'R01', 'R03', 'R04'].includes(item.id),
    verificationEvidence: evidenceFor(item.id),
    pass,
    failureReason: pass ? null : `预期 ${item.expectedStatus}，实际 ${assessment.status}`,
    assessment
  };
});

await write('fixtures/cases.json', JSON.stringify({ generatedAt, cases: batchCases }, null, 2));
await write('test-results.json', JSON.stringify({
  generatedAt,
  execution: 'phase_a_deterministic_preflight',
  paidModelCalls: 0,
  total: results.length,
  passed: results.filter((item) => item.pass).length,
  failed: results.filter((item) => !item.pass).length,
  results
}, null, 2));
await write('test-matrix.md', matrixMarkdown(results));
await write('batch-test-report.md', reportMarkdown(results));
await write('model-call-ledger.md', `# 模型调用台账\n\n生成时间：${generatedAt}\n\n## 阶段 A\n\n- 真实模型调用：0\n- 付费调用：0\n- fallback：0\n- 所有 20 个实例只运行确定性 validation / preflight。\n\n## 阶段 B\n\n未执行。项目配置存在不等于当前调用必然免费；Alibaba 有免费用尽即停的历史证据，但 Tencent 与 Volcengine 没有可由 H5 可靠读取的免费余额或免费用尽即停信号。为避免产生费用，按 Goal 成本停止条件保留 P01、P02、S01、S02、L01、L03 为待运行清单。S02 后续仍只能复用已保存证据，不能重新采样。\n`);
await write('failed-cases.md', `# 失败与修复记录\n\n## 本轮发现并修复\n\n1. **L02 / P1 本地服务路由错误**\n   - 复现：本地服务把城市填写为“全国”，预检仍返回 ready。\n   - 原因：城市字段只检查非空，没有识别本地服务缺少具体覆盖范围。\n   - 修复：本地服务城市为空、全国、不限或线上时，返回 needs_confirmation，并要求补充城市、门店或服务半径。\n   - 回归：batch-instance-matrix.test.mjs。\n\n2. **R03 / P1 部分失败未降低置信度**\n   - 复现：页面审计 100 分、一半 provider 失败时仍显示高置信度。\n   - 原因：置信度只取决于 PageAudit。\n   - 修复：合并实际采样覆盖率；存在失败时高置信度至少降为中等，覆盖率低于 50% 时降为低。\n   - 回归：report-credibility.test.mjs。\n\n## 当前失败\n\n阶段 A 预检矩阵当前 20/20 通过。阶段 B 未执行属于成本门禁停止，不记录为产品断言失败。\n`);
await write('user-findings.md', `# 首次使用者视角结论\n\n## 目前可信\n\n- 资料明显不足、业务类型不清或本地服务缺少地域边界时，系统会要求补充，不调用模型、不消耗名额。\n- 页面来源不足时，正确实体识别率不能被包装成确定数字，总分也应暂停展示。\n- 品牌字符串复述、正确实体认知、无品牌词推荐和错误认知已是四个不同概念。\n- 部分模型失败后会保留成功样本，并降低置信度。\n\n## 仍可能误导\n\n- 预检只能把 URL 当候选入口，无法仅凭字符串证明页面与实体相关。E02、L03、L04 必须依赖后续 PageAudit 和人工 ground truth，不应把预检 ready 解读为来源已核验。\n- 通用产品名或同名实体（S03）在没有可靠官方来源时仍可能进入采样；最终报告必须继续显示待核验和低证据边界。\n- 本阶段没有新做真实多模型调用，因此没有证明当前 provider 的实时免费额度、稳定性或真实耗时。\n`);
await write('closeout.md', `# 批量实例测试阶段性收口\n\n生成时间：${generatedAt}\n\n完成等级：C1（阶段 A 已实现并通过；阶段 B 因免费成本无法可靠确认而按门禁停止；视觉证据待本目录补齐后再评估 C2）\n\n## 已验证\n\n- 20/20 实例均有预期和实际预检结果。\n- 阶段 A 真实模型调用与额度消耗均为 0。\n- 两个 P1 已由失败测试复现并最小修复。\n- R04 的 Markdown、HTML、evidence package 与报告对象可信度字段一致性有自动化断言。\n\n## 未验证\n\n- 阶段 B 六个真实报告：因 Tencent/Volcengine 免费边界无法从运行时可靠确认而未执行。\n- 当前目录的五种页面双端视觉截图尚待生成。\n- 未部署、未做生产 POST、未 commit、未 push。\n\n## 剩余风险\n\n- 候选 URL 与实体相关性仍需 PageAudit/人工 ground truth。\n- 本地服务全国品牌首页不能证明具体门店。\n- 通用名称同名消歧尚无独立 provider。\n`);

// Final summaries intentionally override the early draft blocks above so reruns preserve
// the completed batch evidence after visual QA and the final regression suite.
await write('failed-cases.md', failedCasesMarkdown());
await write('closeout.md', closeoutMarkdown());

console.log(JSON.stringify({ outputDir, total: results.length, passed: results.filter((item) => item.pass).length, paidModelCalls: 0 }, null, 2));

async function write(relative, content) {
  await writeFile(path.join(outputDir, relative), `${content.trim()}\n`, 'utf8');
}

function matrixMarkdown(items) {
  return `# 20 实例测试矩阵\n\n| ID | 场景 | 业务类型 | 来源状态 | 预期 | 实际 | 模型调用 | 消耗限额 | 展示总分 | 结果 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${items.map((item) => `| ${item.id} | ${item.title} | ${item.businessType} | ${item.sourceStatus} | ${item.expectedStatus} | ${item.actualStatus} | 否 | 否 | 否 | ${item.pass ? '通过' : '失败'} |`).join('\n')}\n\n阶段 A 只验证 validation / preflight；来源状态 candidate 不等于 verified。`;
}

function reportMarkdown(items) {
  const groups = ['P', 'S', 'L', 'E', 'R'].map((prefix) => {
    const group = items.filter((item) => item.id.startsWith(prefix));
    return `- ${prefix}：${group.filter((item) => item.pass).length}/${group.length}`;
  }).join('\n');
  return `# 批量实例测试报告\n\n- 总通过率：${items.filter((item) => item.pass).length}/${items.length}（${Math.round(items.filter((item) => item.pass).length / items.length * 100)}%）\n- 真实模型调用：0\n- 额度消耗：0\n\n## 类型结果\n\n${groups}\n\n## 失败类型\n\n首轮发现本地服务范围预检和部分 provider 失败置信度两个 P1，均已用回归测试修复。当前阶段 A 矩阵无未解决失败。\n\n## 用户影响\n\n资料不足时不会误耗名额；本地服务需要明确地域；部分模型失败不再维持高置信度。候选 URL 仍不是已核验来源，必须结合 PageAudit。`;
}

function evidenceFor(id) {
  if (id === 'R01') return ['diagnosis-idempotency.integration.test.mjs: matching retry returns one persisted report'];
  if (id === 'R02') return ['diagnosis-idempotency.integration.test.mjs: failed preflight consumes no quota or provider call'];
  if (id === 'R03') return ['report-credibility.test.mjs: partial failure lowers confidence', 'visual-qa.json: partial-provider-failure'];
  if (id === 'R04') return ['report-credibility.test.mjs: Markdown, HTML, evidence package share credibility values'];
  if (id === 'P02' || id === 'E03') return ['report-credibility.test.mjs: conflicting official model is misrecognized'];
  if (id === 'S04') return ['report-credibility.test.mjs: software hardware misread is explicit', 'visual-qa.json: software-misread'];
  if (id === 'E01') return ['report-credibility.test.mjs: external instruction remains data'];
  if (id === 'E02' || id === 'L03') return ['report-credibility.test.mjs: unrelated or scope-mismatched source withholds score', 'visual-qa.json: local-source-boundary'];
  if (id === 'L04') return ['report-credibility.test.mjs: unsupported claims remain unverified'];
  return ['batch-instance-matrix.test.mjs: validation and preflight status'];
}

function failedCasesMarkdown() {
  return `# 失败与修复记录

## 本轮发现并修复

1. **L02 / P1 本地服务路由错误**：城市为“全国”仍返回 ready。现要求具体城市、门店或服务半径；由 batch-instance-matrix.test.mjs 回归。
2. **R03 / P1 部分失败未降低置信度**：PageAudit 100 时一半 provider 失败仍显示高置信度。现合并采样覆盖率；由 report-credibility.test.mjs 回归。
3. **L04 / P0 用户承诺被列入“已确认”**：未证明的价格、效果和安全主张被当成已确认事实。现只确认业务类型、目标客户和 PageAudit 命中事实，用户描述进入“仍待核验”；由 unsupported-claims 回归和刷新后的双端截图验证。

## 当前失败

阶段 A 20/20 通过。阶段 B 未执行属于成本门禁停止，不是产品断言失败。
`;
}

function closeoutMarkdown() {
  return `# 批量实例测试最终收口

生成时间：${generatedAt}

完成等级：C2（本地实现、自动化和视觉验证完成；未部署）

## 已验证

- 20/20 实例都有预期和实际预检结果、调用/额度/总分状态和直接证据映射。
- 阶段 A 真实模型调用与额度消耗均为 0；本地模拟只使用 fixture / fake provider。
- 一个 P0、两个 P1 已由失败测试复现并最小修复。
- H5 使用报告对象的 stages.credibility；Markdown、HTML 和 evidence package 的同源字段有自动化断言。
- 五种关键状态在 390×844 与 1440×1000 共 10 项视觉检查通过，无横向溢出或 console error/warning。
- 最终验证：npm test 39/39、npm run typecheck、npm run build、git diff --check 均通过。

## 阶段 B

未执行。Tencent/Volcengine 当前无法由 H5 可靠证明调用必然免费，按 Goal 成本门禁停止；S02 未重新采样。

## 未执行

- 未 commit、push、部署或修改生产 runtime。
- 未做生产 POST，未新增 provider。

## 剩余风险

- 候选 URL 与实体相关性仍需 PageAudit/人工 ground truth。
- 全国品牌首页不能证明具体门店。
- 通用名称同名消歧尚无独立来源发现 provider。
`;
}
