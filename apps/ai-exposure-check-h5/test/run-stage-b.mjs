import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { batchCases } from './batch-instance-cases.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/batch-instance-testing-20260712');
const runtimeDir = process.env.STAGE_B_RUNTIME_DIR
  ? path.resolve(appRoot, process.env.STAGE_B_RUNTIME_DIR)
  : path.join(outputDir, 'stage-b-runtime');
const resultPath = process.env.STAGE_B_RESULT_PATH
  ? path.resolve(appRoot, process.env.STAGE_B_RESULT_PATH)
  : path.join(outputDir, 'stage-b-run-results.json');
const requestSuffix = process.env.STAGE_B_REQUEST_SUFFIX || '01';
const port = Number(process.env.STAGE_B_PORT || 8792);
const baseUrl = `http://127.0.0.1:${port}`;
const realCaseIds = ['P01', 'P02', 'S01', 'L01', 'L03'];
const expectedModels = {
  deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
  hy3: process.env.HY3_MODEL || 'hy3',
  qwen: process.env.QWEN_MODEL || 'qwen3.7-plus',
  doubao: process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260215'
};

await mkdir(runtimeDir, { recursive: true });
const run = {
  startedAt: new Date().toISOString(),
  finishedAt: null,
  authorization: '用户于 2026-07-12 明确确认火山方舟后台免费边界并授权全量执行阶段 B。',
  configuredProviders: [],
  cases: [],
  totals: { realReports: 0, reusedReports: 0, uniqueQuestions: 0, providerRequests: 0, successes: 0, failures: 0, fallbackCount: 0 },
  stoppedEarly: false,
  stopReason: null
};

const server = spawn(process.execPath, ['dist/server/server/index.js'], {
  cwd: appRoot,
  env: {
    ...process.env,
    PORT: String(port),
    RUNTIME_DIR: runtimeDir,
    DIAGNOSES_IP_HOURLY_LIMIT: '10',
    DIAGNOSES_GLOBAL_DAILY_LIMIT: '10',
    DEEPSEEK_POLISH_ENABLED: 'false',
    DEEPSEEK_SAMPLE_MAX_RETRIES: '1',
    HY3_SAMPLE_MAX_RETRIES: '1',
    QWEN_SAMPLE_MAX_RETRIES: '1',
    DOUBAO_SAMPLE_MAX_RETRIES: '1'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (chunk) => process.stdout.write(chunk));
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

try {
  const health = await waitForHealth();
  const readyProviders = health.providers.filter((provider) => provider.status === 'ready');
  run.configuredProviders = readyProviders.map(({ provider, model, status }) => ({ provider, model, status }));
  if (readyProviders.length !== 4) {
    throw new Error(`stage_b_requires_four_ready_providers:${readyProviders.length}`);
  }

  for (const [index, id] of realCaseIds.entries()) {
    const item = batchCases.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`missing_batch_case:${id}`);

    const clientRequestId = `stage_b_20260712_${id.toLowerCase()}_${requestSuffix}`;
    const input = { ...item.input, clientRequestId, source: 'codex_stage_b_20260712' };
    const preflight = await postJson('/api/diagnoses/preflight', input, index);
    if (preflight.status !== 200 || preflight.body.assessment?.status !== 'ready') {
      throw new Error(`stage_b_preflight_failed:${id}:${preflight.status}:${preflight.body.assessment?.status || 'unknown'}`);
    }

    const startedAt = Date.now();
    const response = await postJson('/api/diagnoses', input, index);
    const durationMs = Date.now() - startedAt;
    if (![200, 201].includes(response.status) || !response.body.report?.id) {
      throw new Error(`stage_b_report_failed:${id}:${response.status}:${response.body.error || 'unknown'}`);
    }

    const report = response.body.report;
    const samplesPath = path.join(runtimeDir, 'evidence', report.id, 'samples.json');
    const samples = JSON.parse(await readFile(samplesPath, 'utf8'));
    const uniqueQuestionCount = new Set(samples.map((sample) => sample.prompt.id)).size;
    const providerRows = report.aiMeta.providers.map((provider) => ({
      provider: provider.provider,
      model: provider.model,
      status: provider.status,
      promptCount: provider.promptCount,
      successCount: provider.successCount,
      failureCount: provider.failureCount,
      fallbackUsed: provider.model !== expectedModels[provider.provider]
    }));
    const billingSignal = samples.find((sample) =>
      sample.status === 'failed' && /billing|balance|payment|overdue|insufficient|quota|resource.?package|付费|余额|欠费|额度/iu.test(sample.error || '')
    );
    const accessSignal = samples.find((sample) =>
      sample.status === 'failed' && /403|access.?denied|allowlist|白名单|not activated|permission|forbidden/iu.test(sample.error || '')
    );
    const fallbackCount = providerRows.filter((provider) => provider.fallbackUsed).length;
    const result = {
      id,
      title: item.title,
      execution: 'real_multi_provider',
      reportId: report.id,
      durationMs,
      uniqueQuestionCount,
      providerRequestCount: samples.length,
      sampleCount: samples.length,
      successCount: samples.filter((sample) => sample.status === 'success').length,
      failureCount: samples.filter((sample) => sample.status === 'failed').length,
      fallbackCount,
      providers: providerRows,
      pageAudit: {
        score: report.stages.infrastructure.pageAudit.targets.length ? report.stages.infrastructure.pageAudit.score : null,
        targetCount: report.stages.infrastructure.pageAudit.targets.length,
        summary: report.stages.infrastructure.pageAudit.summary
      },
      credibility: report.stages.credibility,
      scoreStatus: report.stages.credibility.scoreStatus,
      displayedScore: report.stages.credibility.scoreStatus === 'available' ? report.score : null,
      billingSignal: billingSignal?.error || null,
      accessSignal: accessSignal?.error || null
    };
    run.cases.push(result);
    run.totals.realReports += 1;
    run.totals.uniqueQuestions += result.uniqueQuestionCount;
    run.totals.providerRequests += result.providerRequestCount;
    run.totals.successes += result.successCount;
    run.totals.failures += result.failureCount;
    run.totals.fallbackCount += result.fallbackCount;
    await persist();

    if (billingSignal) {
      run.stoppedEarly = true;
      run.stopReason = `${id} 返回计费或额度风险信号：${billingSignal.error}`;
      break;
    }
    if (accessSignal) {
      run.stoppedEarly = true;
      run.stopReason = `${id} 返回权限或 IP 白名单信号：${accessSignal.error}`;
      break;
    }
  }

  const fridgePackagePath = path.join(repoRoot, 'outputs/h5-mvp/fridge-radar-4model-20260711/evidence-package.pretty.json');
  const fridge = JSON.parse(await readFile(fridgePackagePath, 'utf8'));
  run.cases.push({
    id: 'S02',
    title: '冰箱小雷达复用已保存证据',
    execution: 'reused_saved_four_provider_evidence',
    reportId: fridge.report?.id || fridge.reportId || null,
    promptCount: fridge.report?.aiMeta?.promptCount || 0,
    sampleCount: fridge.samples.length,
    successCount: fridge.samples.filter((sample) => sample.status === 'success').length,
    failureCount: fridge.samples.filter((sample) => sample.status === 'failed').length,
    fallbackCount: 0,
    providers: fridge.providerStatuses,
    pageAudit: {
      score: fridge.pageAudit.score,
      targetCount: fridge.pageAudit.targets.length,
      summary: fridge.pageAudit.summary
    },
    note: '按 Goal 约束只复用 2026-07-11 已保存四模型证据，本轮新增调用为 0。'
  });
  run.totals.reusedReports = 1;
  run.finishedAt = new Date().toISOString();
  await persist();
  console.log(JSON.stringify({ resultPath, totals: run.totals, stoppedEarly: run.stoppedEarly }, null, 2));
} finally {
  server.kill('SIGTERM');
}

async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error('stage_b_server_health_timeout');
}

async function postJson(route, body, index) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `127.0.0.${index + 2}`
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, body: payload };
}

async function persist() {
  await writeFile(resultPath, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
}
