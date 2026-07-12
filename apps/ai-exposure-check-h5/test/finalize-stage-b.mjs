import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeProviderError } from '../dist/server/server/deepseek.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/batch-instance-testing-20260712');
const runtimeDir = path.join(outputDir, 'stage-b-runtime');
const runPath = path.join(outputDir, 'stage-b-run-results.json');
const run = JSON.parse(await readFile(runPath, 'utf8'));
const expectedModels = Object.fromEntries(run.configuredProviders.map((item) => [item.provider, item.model]));

const realCases = [];
for (const item of run.cases.filter((candidate) => candidate.execution === 'real_multi_provider')) {
  const samples = JSON.parse(await readFile(path.join(runtimeDir, 'evidence', item.reportId, 'samples.json'), 'utf8'));
  const uniqueQuestionCount = new Set(samples.map((sample) => sample.prompt.id)).size;
  const fallbackSamples = samples.filter((sample) => sample.model !== expectedModels[sample.provider]);
  const accessErrors = [...new Set(samples
    .filter((sample) => sample.status === 'failed' && /403|access.?denied|allowlist|白名单|forbidden/iu.test(sample.error || ''))
    .map((sample) => `${sample.provider}: ${sanitizeProviderError(sample.error || '')}`))];
  realCases.push({
    ...item,
    uniqueQuestionCount,
    providerRequestSlots: samples.length,
    inferredHttpAttempts: samples.length + fallbackSamples.length,
    fallbackCount: fallbackSamples.length,
    accessErrors,
    providers: item.providers.map((provider) => ({
      ...provider,
      fallbackUsed: fallbackSamples.some((sample) => sample.provider === provider.provider)
    }))
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  authorization: run.authorization,
  realReportCount: realCases.length,
  reusedReportCount: run.cases.filter((item) => item.execution === 'reused_saved_four_provider_evidence').length,
  uniqueQuestionCount: realCases.reduce((sum, item) => sum + item.uniqueQuestionCount, 0),
  providerRequestSlots: realCases.reduce((sum, item) => sum + item.providerRequestSlots, 0),
  inferredHttpAttempts: realCases.reduce((sum, item) => sum + item.inferredHttpAttempts, 0),
  successCount: realCases.reduce((sum, item) => sum + item.successCount, 0),
  failureCount: realCases.reduce((sum, item) => sum + item.failureCount, 0),
  fallbackCount: realCases.reduce((sum, item) => sum + item.fallbackCount, 0),
  completeFourProviderReports: realCases.filter((item) => item.providers.every((provider) => provider.successCount === provider.promptCount)).length,
  scoreWithheldReports: realCases.filter((item) => item.scoreStatus === 'withheld').length,
  lowConfidenceReports: realCases.filter((item) => item.credibility?.confidence === 'low').length,
  billingSignals: realCases.flatMap((item) => item.billingSignal ? [item.billingSignal] : []),
  accessErrors: [...new Set(realCases.flatMap((item) => item.accessErrors))],
  providerTotals: providerTotals(realCases),
  cases: realCases.map((item) => ({
    id: item.id,
    reportId: item.reportId,
    durationMs: item.durationMs,
    uniqueQuestionCount: item.uniqueQuestionCount,
    providerRequestSlots: item.providerRequestSlots,
    inferredHttpAttempts: item.inferredHttpAttempts,
    successCount: item.successCount,
    failureCount: item.failureCount,
    fallbackCount: item.fallbackCount,
    providers: item.providers,
    pageAudit: item.pageAudit,
    scoreStatus: item.scoreStatus,
    displayedScore: item.displayedScore,
    credibility: item.credibility
  }))
};

await writeFile(path.join(outputDir, 'stage-b-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'stage-b-report.md'), reportMarkdown(summary, run), 'utf8');
await writeFile(path.join(outputDir, 'model-call-ledger.md'), ledgerMarkdown(summary, run), 'utf8');

const testResultsPath = path.join(outputDir, 'test-results.json');
const testResults = JSON.parse(await readFile(testResultsPath, 'utf8'));
testResults.stageB = {
  status: 'executed_partial_provider_coverage',
  summaryFile: 'stage-b-summary.json',
  realReportCount: summary.realReportCount,
  reusedReportCount: summary.reusedReportCount,
  completeFourProviderReports: summary.completeFourProviderReports,
  successCount: summary.successCount,
  failureCount: summary.failureCount,
  scoreWithheldReports: summary.scoreWithheldReports,
  conclusion: '5 个真实实例均完成，但本机出口 IP 被百炼和 TokenHub API Key 白名单拒绝，只有火山方舟成功；本轮四模型阶段 B 不通过。'
};
await writeFile(testResultsPath, `${JSON.stringify(testResults, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(summary, null, 2));

function providerTotals(cases) {
  const totals = {};
  for (const item of cases) for (const provider of item.providers) {
    const current = totals[provider.provider] || { provider: provider.provider, model: provider.model, promptSlots: 0, successCount: 0, failureCount: 0, fallbackPromptCount: 0 };
    current.promptSlots += provider.promptCount;
    current.successCount += provider.successCount;
    current.failureCount += provider.failureCount;
    if (provider.fallbackUsed) current.fallbackPromptCount += provider.promptCount;
    totals[provider.provider] = current;
  }
  return Object.values(totals);
}

function reportMarkdown(summary, run) {
  const caseRows = summary.cases.map((item) => `| ${item.id} | ${item.reportId} | ${seconds(item.durationMs)} | ${item.successCount}/${item.providerRequestSlots} | ${item.pageAudit.score == null ? '未检测' : item.pageAudit.score} | ${item.credibility.confidence} | ${item.scoreStatus === 'withheld' ? '暂停展示' : item.displayedScore} |`).join('\n');
  const providerRows = summary.providerTotals.map((item) => `| ${item.provider} | ${item.model} | ${item.successCount}/${item.promptSlots} | ${item.failureCount} | ${item.fallbackPromptCount} |`).join('\n');
  return `# 阶段 B 真实多模型测试报告

- 执行时间：${run.startedAt} 至 ${run.finishedAt}
- 授权：${run.authorization}
- 真实新报告：${summary.realReportCount}
- 复用报告：${summary.reusedReportCount}（S02 冰箱小雷达，未新增调用）
- 唯一测试问题：${summary.uniqueQuestionCount}
- provider × prompt 槽位：${summary.providerRequestSlots}
- 可推断实际 HTTP 尝试：${summary.inferredHttpAttempts}（含 DeepSeek fallback）
- 成功/失败样本：${summary.successCount}/${summary.failureCount}
- 完整四模型报告：${summary.completeFourProviderReports}/${summary.realReportCount}

## 实例结果

| ID | 报告 ID | 耗时 | 成功/槽位 | PageAudit | 置信度 | 用户总分 |
| --- | --- | ---: | ---: | ---: | --- | --- |
${caseRows}

## Provider 结果

| Provider | 最终模型 | 成功/槽位 | 失败 | fallback 问题数 |
| --- | --- | ---: | ---: | ---: |
${providerRows}

## 已确认失败原因

- 百炼 DeepSeek：本机出口 IP 不在 API Key 白名单；主模型失败后按既有规则 fallback 到 deepseek-v4-flash，仍返回 403。
- 百炼 Qwen：本机出口 IP 不在 API Key 白名单，50/50 失败。
- 腾讯 TokenHub Hy3：后台明确返回 Source IP 不在 API Key allowlist，50/50 失败。
- 火山方舟 Doubao Seed 2.0 Lite：50/50 成功，无 fallback、无余额或计费错误。
- 本轮没有发现 billing、balance、overdue 或付费信号。

## 可信度合同表现

- 5/5 新报告都把覆盖率缺失写入“仍待核验”，置信度降为 low。
- 5/5 新报告都暂停展示用户总分，没有把单一 provider 结果包装成完整四模型结论。
- 页面和导出保留成功样本，不用模拟结果填补三家失败。
- P01/P02 的松下官方页和 L01/L03 的海底捞入口未被 PageAudit 充分核验，属于来源抓取/匹配的真实 P1，不是可以忽略的噪声。

## 结论

阶段 B 的六个指定实例都已覆盖，但本轮真实四模型链路 **不通过**：5 个新实例只有火山方舟成功，provider 槽位覆盖率为 ${percent(summary.successCount / summary.providerRequestSlots)}。可信度保护本身通过，没有出现 P0 级误出分或伪造样本；当前阻塞是 API Key IP 白名单和官方页面 PageAudit 识别率。
`;
}

function ledgerMarkdown(summary, run) {
  const providerRows = summary.providerTotals.map((item) => `| ${item.provider} | ${item.model} | ${item.promptSlots} | ${item.successCount} | ${item.failureCount} | ${item.fallbackPromptCount} |`).join('\n');
  return `# 模型调用台账

生成时间：${summary.generatedAt}

## 阶段 A

- 真实模型调用：0
- 付费调用：0
- fallback：0
- 所有 20 个实例只运行确定性 validation / preflight。

## 阶段 B

- 用户成本授权：${run.authorization}
- 新增真实报告：${summary.realReportCount}
- S02 复用报告：1，新增调用 0
- 唯一问题：${summary.uniqueQuestionCount}
- provider × prompt 槽位：${summary.providerRequestSlots}
- 可推断 HTTP 尝试：${summary.inferredHttpAttempts}
- 成功样本：${summary.successCount}
- 失败样本：${summary.failureCount}
- DeepSeek fallback 问题：${summary.fallbackCount}
- billing/余额/欠费信号：${summary.billingSignals.length}

| Provider | 模型 | 问题槽位 | 成功 | 失败 | fallback 问题 |
| --- | --- | ---: | ---: | ---: | ---: |
${providerRows}

失败原因：百炼 DeepSeek/Qwen 与腾讯 Hy3 均被 API Key IP 白名单以 403 拒绝；火山方舟 50/50 成功。权限错误不再重试，未修改任何云端白名单设置。
`;
}

function seconds(ms) { return `${(ms / 1000).toFixed(1)}s`; }
function percent(value) { return `${Math.round(value * 1000) / 10}%`; }
