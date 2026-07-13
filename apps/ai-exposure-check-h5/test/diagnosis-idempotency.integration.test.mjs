import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, readdir } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { startFakeOpenAiServer } from './support/fake-openai-server.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(appRoot, 'dist/server/server/index.js');

test('lost response and retries recover one persisted report without consuming another quota slot', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-idempotency-success-'));
  const provider = await startFakeOpenAiServer({ delayMs: 120 });
  let appServer = await startAppServer({ runtimeDir, providerBaseUrl: provider.baseUrl });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const payload = buildPayload('req_controlled_recovery_01');
  const lostRequest = beginPost(appServer.url, payload);

  await waitFor(() => provider.callCount >= 1, 'first request did not reach the controlled provider');
  lostRequest.request.destroy(new Error('controlled_client_disconnect'));
  await lostRequest.settled;

  const recovered = await postJson(appServer.url, payload);
  assert.equal(recovered.status, 200);
  assert.match(recovered.body.report.id, /^diag_[a-z0-9_]+$/u);

  const repeated = await postJson(appServer.url, payload);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.report.id, recovered.body.report.id);
  assert.equal(provider.callCount, 1, 'one sample call should serve all same-ID retries');

  const conflict = await postJson(appServer.url, { ...payload, description: '另一份体检内容' });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, 'idempotency_conflict');

  const differentRequest = await postJson(appServer.url, {
    ...payload,
    clientRequestId: 'req_controlled_recovery_02'
  });
  assert.equal(differentRequest.status, 429);
  assert.equal(differentRequest.body.error, 'rate_limited');
  assert.equal(provider.callCount, 1);

  const diagnosisFiles = await readdir(path.join(runtimeDir, 'diagnoses'));
  assert.deepEqual(diagnosisFiles, [`${recovered.body.report.id}.json`]);

  const requestIndex = JSON.parse(await readFile(
    path.join(runtimeDir, 'request-index', `${payload.clientRequestId}.json`),
    'utf8'
  ));
  assert.equal(requestIndex.reportId, recovered.body.report.id);
  assert.match(requestIndex.requestFingerprint, /^[a-f0-9]{64}$/u);

  const submissions = await readFile(path.join(runtimeDir, 'submissions.jsonl'), 'utf8');
  const submissionLines = submissions
    .trim()
    .split('\n');
  assert.equal(submissionLines.length, 1);
  assert.doesNotMatch(submissions, new RegExp(payload.clientRequestId, 'u'));

  const publicEvidencePackage = await readFile(
    path.join(runtimeDir, 'evidence', recovered.body.report.id, 'exports', 'evidence-package.json'),
    'utf8'
  );
  assert.doesNotMatch(publicEvidencePackage, new RegExp(payload.clientRequestId, 'u'));

  await stopProcess(appServer.process);
  const callsBeforeRestart = provider.callCount;
  appServer = await startAppServer({ runtimeDir, providerBaseUrl: provider.baseUrl });

  const afterRestart = await postJson(appServer.url, payload);
  assert.equal(afterRestart.status, 200);
  assert.equal(afterRestart.body.report.id, recovered.body.report.id);
  assert.equal(provider.callCount, callsBeforeRestart, 'persistent recovery must not call the model again');

  const differentAfterRestart = await postJson(appServer.url, {
    ...payload,
    clientRequestId: 'req_controlled_recovery_03'
  });
  assert.equal(differentAfterRestart.status, 429, 'hourly quota must survive process restart');
  assert.equal(provider.callCount, callsBeforeRestart, 'persistent limiter must stop before model sampling');
  const rateLimitState = await readFile(path.join(runtimeDir, 'rate-limits.json'), 'utf8');
  assert.doesNotMatch(rateLimitState, /127\.0\.0\.1|::ffff/u);
});

test('default 10 prompt diagnosis uses five concurrent samples without a second narrative model call', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-sampling-speed-'));
  const provider = await startFakeOpenAiServer({ delayMs: 200 });
  const appServer = await startAppServer({ runtimeDir, providerBaseUrl: provider.baseUrl });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const healthResponse = await fetch(`${appServer.url}/api/health`);
  const health = await healthResponse.json();
  assert.equal(health.sampleConcurrency, 5);
  assert.equal(health.sampleMaxRetries, 1);

  const payload = buildPayload('req_controlled_speed_01');
  delete payload.samplePrompts;
  const startedAt = Date.now();
  const result = await postJson(appServer.url, payload);
  const durationMs = Date.now() - startedAt;

  assert.equal(result.status, 201);
  assert.equal(result.body.report.aiMeta.promptCount, 10);
  assert.equal(result.body.report.aiMeta.successCount, 10);
  assert.deepEqual(
    result.body.report.stages.promptUniverse.prompts.map((prompt) => prompt.id),
    ['P001', 'P002', 'P003', 'P005', 'P006', 'P011', 'P013', 'P015', 'P017', 'P020']
  );
  assert.equal(provider.callCount, 10, 'default path must not add a second narrative model call');
  assert.equal(provider.peakConcurrency, 5);
  assert.ok(durationMs < 1_500, `controlled 10-prompt run took ${durationMs}ms`);
  const observedHealth = await (await fetch(`${appServer.url}/api/health`)).json();
  assert.ok(observedHealth.latestOperation.totalDurationMs > 0);
  assert.ok(observedHealth.latestOperation.samplingDurationMs > 0);
  assert.ok(observedHealth.latestOperation.pageAuditDurationMs >= 0);
  const observedDeepSeek = observedHealth.providers.find((item) => item.provider === 'deepseek');
  assert.equal(observedDeepSeek.successRate, 1);
  assert.equal(observedDeepSeek.fallbackCount, 0);
  assert.ok(observedDeepSeek.p50LatencyMs > 0);
  assert.ok(observedDeepSeek.p95LatencyMs >= observedDeepSeek.p50LatencyMs);
  assert.match(observedDeepSeek.slowestPromptId, /^P\d{3}$/u);
  const operationFile = await readFile(path.join(runtimeDir, 'operations', 'latest.json'), 'utf8');
  assert.doesNotMatch(operationFile, new RegExp(payload.businessName, 'u'));
  context.diagnostic(`controlled 10-prompt wall time: ${durationMs}ms`);
});

test('DeepSeek, Hy3, Qwen, and Doubao sample in parallel with provider-specific non-thinking parameters', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-multi-provider-'));
  const provider = await startFakeOpenAiServer({ delayMs: 200 });
  const appServer = await startAppServer({
    runtimeDir,
    providerBaseUrl: provider.baseUrl,
    appEnv: {
      HY3_ENABLED: 'true',
      HY3_API_KEY: 'controlled-hy3-key',
      HY3_BASE_URL: provider.baseUrl,
      HY3_MODEL: 'controlled-hy3',
      HY3_SAMPLE_CONCURRENCY: '4',
      HY3_SAMPLE_MAX_RETRIES: '0',
      QWEN_ENABLED: 'true',
      QWEN_MODEL: 'controlled-qwen',
      QWEN_SAMPLE_CONCURRENCY: '4',
      QWEN_SAMPLE_MAX_RETRIES: '0',
      DOUBAO_ENABLED: 'true',
      DOUBAO_API_KEY: 'controlled-doubao-key',
      DOUBAO_BASE_URL: provider.baseUrl,
      DOUBAO_MODEL: 'controlled-doubao',
      DOUBAO_SAMPLE_CONCURRENCY: '4',
      DOUBAO_SAMPLE_MAX_RETRIES: '0'
    }
  });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const healthResponse = await fetch(`${appServer.url}/api/health`);
  const health = await healthResponse.json();
  assert.equal(health.configuredProviderCount, 4);

  const payload = {
    ...buildPayload('req_controlled_multi_provider_01'),
    samplePrompts: Array.from({ length: 5 }, (_, index) => `第 ${index + 1} 条多平台采样问题是什么？`)
  };
  const startedAt = Date.now();
  const result = await postJson(appServer.url, payload);
  const durationMs = Date.now() - startedAt;

  assert.equal(result.status, 201);
  assert.equal(result.body.report.aiMeta.promptCount, 20);
  assert.equal(result.body.report.aiMeta.successCount, 20);
  assert.equal(result.body.report.stages.promptUniverse.prompts.length, 5);
  assert.equal(provider.callCount, 20);
  assert.equal(provider.peakConcurrency, 17);
  assert.ok(durationMs < 1_500, `controlled multi-provider run took ${durationMs}ms`);

  const statusByProvider = Object.fromEntries(result.body.report.aiMeta.providers.map((status) => [status.provider, status]));
  assert.equal(statusByProvider.deepseek.status, 'sampled');
  assert.equal(statusByProvider.hy3.status, 'sampled');
  assert.equal(statusByProvider.qwen.status, 'sampled');
  assert.equal(statusByProvider.doubao.status, 'sampled');

  const deepseekRequest = provider.requests.find((request) => request.model === 'controlled-model');
  const hy3Request = provider.requests.find((request) => request.model === 'controlled-hy3');
  const qwenRequest = provider.requests.find((request) => request.model === 'controlled-qwen');
  const doubaoRequest = provider.requests.find((request) => request.model === 'controlled-doubao');
  assert.equal(deepseekRequest.enable_thinking, false);
  assert.equal(deepseekRequest.thinking, undefined);
  assert.deepEqual(hy3Request.thinking, { type: 'disabled' });
  assert.equal(qwenRequest.enable_thinking, false);
  assert.equal(qwenRequest.thinking, undefined);
  assert.deepEqual(doubaoRequest.thinking, { type: 'disabled' });
  context.diagnostic(`controlled four-provider wall time: ${durationMs}ms`);
});

test('Bailian DeepSeek falls back from v4-pro to v4-flash after free quota exhaustion', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-deepseek-fallback-'));
  const provider = await startFakeOpenAiServer({
    delayMs: 20,
    failModels: {
      'controlled-deepseek-pro': {
        status: 403,
        code: 'AllocationQuota.FreeTierOnly',
        message: 'controlled free tier quota exhausted'
      }
    }
  });
  const appServer = await startAppServer({
    runtimeDir,
    providerBaseUrl: provider.baseUrl,
    appEnv: {
      DEEPSEEK_MODEL: 'controlled-deepseek-pro',
      DEEPSEEK_FALLBACK_MODELS: 'controlled-deepseek-flash',
      DEEPSEEK_SAMPLE_CONCURRENCY: '1',
      DEEPSEEK_SAMPLE_MAX_RETRIES: '0'
    }
  });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const result = await postJson(appServer.url, {
    ...buildPayload('req_controlled_deepseek_fallback_01'),
    samplePrompts: ['百炼 DeepSeek 免费额度切换受控问题是什么？']
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.report.aiMeta.promptCount, 1);
  assert.equal(result.body.report.aiMeta.successCount, 1);
  assert.deepEqual(provider.requests.map((request) => request.model), [
    'controlled-deepseek-pro',
    'controlled-deepseek-flash'
  ]);

  const deepseekStatus = result.body.report.aiMeta.providers.find((status) => status.provider === 'deepseek');
  assert.equal(deepseekStatus.status, 'sampled');
  assert.equal(deepseekStatus.model, 'controlled-deepseek-flash');
});

test('Doubao falls back to the next configured model after a quota failure', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-doubao-fallback-'));
  const provider = await startFakeOpenAiServer({
    delayMs: 20,
    failModels: {
      'controlled-doubao-primary': {
        status: 429,
        code: 'quota_exhausted',
        message: 'controlled model quota exhausted'
      }
    }
  });
  const appServer = await startAppServer({
    runtimeDir,
    providerBaseUrl: provider.baseUrl,
    appEnv: {
      DEEPSEEK_ENABLED: 'false',
      DOUBAO_ENABLED: 'true',
      DOUBAO_API_KEY: 'controlled-doubao-key',
      DOUBAO_BASE_URL: provider.baseUrl,
      DOUBAO_MODEL: 'controlled-doubao-primary',
      DOUBAO_FALLBACK_MODELS: 'controlled-doubao-fallback',
      DOUBAO_SAMPLE_CONCURRENCY: '1',
      DOUBAO_SAMPLE_MAX_RETRIES: '0'
    }
  });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const result = await postJson(appServer.url, {
    ...buildPayload('req_controlled_doubao_fallback_01'),
    samplePrompts: ['豆包额度切换受控问题是什么？']
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.report.aiMeta.promptCount, 1);
  assert.equal(result.body.report.aiMeta.successCount, 1);
  assert.equal(provider.callCount, 2);
  assert.deepEqual(provider.requests.map((request) => request.model), [
    'controlled-doubao-primary',
    'controlled-doubao-fallback'
  ]);

  const doubaoStatus = result.body.report.aiMeta.providers.find((status) => status.provider === 'doubao');
  assert.equal(doubaoStatus.status, 'sampled');
  assert.equal(doubaoStatus.model, 'controlled-doubao-fallback');
});

test('validation and shared failing requests do not create a report or duplicate in-flight sampling', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-idempotency-failure-'));
  const provider = await startFakeOpenAiServer({ delayMs: 100, fail: true });
  const appServer = await startAppServer({ runtimeDir, providerBaseUrl: provider.baseUrl });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const invalid = await postJson(appServer.url, buildPayload('short'));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'validation_error');
  assert.equal(provider.callCount, 0);

  const payload = buildPayload('req_controlled_failure_01');
  const firstAttempt = postJson(appServer.url, payload);
  await waitFor(() => provider.callCount >= 1, 'failing request did not reach the controlled provider');
  const joinedAttempt = postJson(appServer.url, payload);

  const [firstFailure, joinedFailure] = await Promise.all([firstAttempt, joinedAttempt]);
  assert.equal(firstFailure.status, 503);
  assert.equal(joinedFailure.status, 503);
  assert.equal(firstFailure.body.error, 'sampling_unavailable');
  assert.equal(joinedFailure.body.error, 'sampling_unavailable');
  assert.equal(provider.callCount, 2, 'one failed sample should have at most one retry');

  const callsAfterSharedFailure = provider.callCount;
  const differentRequest = await postJson(appServer.url, {
    ...payload,
    clientRequestId: 'req_controlled_failure_02'
  });
  assert.equal(differentRequest.status, 429);
  assert.equal(differentRequest.body.error, 'rate_limited');
  assert.equal(provider.callCount, callsAfterSharedFailure);

  await assert.rejects(
    access(path.join(runtimeDir, 'request-index', `${payload.clientRequestId}.json`)),
    (error) => error?.code === 'ENOENT'
  );
  await assert.rejects(
    access(path.join(runtimeDir, 'diagnoses')),
    (error) => error?.code === 'ENOENT'
  );
});

test('input preflight blocks sparse ambiguous submissions before quota or model sampling', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-preflight-'));
  const provider = await startFakeOpenAiServer({ delayMs: 20 });
  const appServer = await startAppServer({ runtimeDir, providerBaseUrl: provider.baseUrl });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const sparse = await postJson(appServer.url, {
    businessName: '松下大锤子剃须刀',
    description: '电动剃须刀',
    links: '',
    industry: '男士清洁工具',
    city: '全国',
    targetCustomers: '成年男性',
    competitors: '',
    clientRequestId: 'req_sparse_preflight_01'
  });
  assert.equal(sparse.status, 422);
  assert.equal(sparse.body.error, 'input_confirmation_required');
  assert.equal(provider.callCount, 0);

  const ready = await postJson(appServer.url, buildPayload('req_after_preflight_01'));
  assert.equal(ready.status, 201, 'preflight rejection must not consume the IP quota slot');
  assert.equal(provider.callCount, 1);
});

test('verified source conflict is rejected before quota and provider sampling', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-source-conflict-'));
  const provider = await startFakeOpenAiServer({
    delayMs: 20,
    pages: {
      '/fixtures/panasonic-es-lm55': '<!doctype html><html><head><title>松下大锤子2.0剃须刀 ES-LM55</title><meta name="description" content="松下 ES-LM55 五刀头电动剃须刀"></head><body>ES-LM55 五刀头 电动剃须刀</body></html>'
    }
  });
  const appServer = await startAppServer({ runtimeDir, providerBaseUrl: provider.baseUrl });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const base = {
    businessName: '松下大锤子2.0剃须刀',
    description: '用户填写型号 ES-LV9C 的五刀头电动剃须刀',
    links: `${provider.origin}/fixtures/panasonic-es-lm55`,
    industry: '电动剃须刀',
    city: '全国',
    targetCustomers: '重视剃净效率和正规售后的成年男性',
    competitors: '同类产品',
    confirmedBusinessType: 'physical_product',
    samplePrompts: ['松下大锤子2.0剃须刀对应什么型号？']
  };

  const rejected = await postJson(appServer.url, { ...base, clientRequestId: 'req_source_conflict_01' });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.error, 'input_confirmation_required');
  assert.equal(provider.callCount, 0, 'source conflict must stop before provider sampling');
  assert.equal(provider.pageCallCount, 1, 'one diagnosis POST must run PageAudit exactly once');

  const corrected = await postJson(appServer.url, {
    ...base,
    description: '官方型号 ES-LM55 的五刀头电动剃须刀',
    clientRequestId: 'req_source_corrected_01'
  });
  assert.equal(corrected.status, 201, 'rejected conflict must not consume the IP quota slot');
  assert.equal(provider.callCount, 1);
  assert.equal(provider.pageCallCount, 2, 'each diagnosis POST must run one authoritative PageAudit');
});

function buildPayload(clientRequestId) {
  return {
    businessName: '请求恢复受控测试',
    description: '验证报告响应丢失后能恢复同一份结果',
    links: '',
    industry: '软件工具',
    city: '西安',
    targetCustomers: '需要验证提交可靠性的测试人员',
    competitors: '',
    source: 'codex_local_acceptance',
    clientRequestId,
    samplePrompts: ['请求恢复受控测试是什么？']
  };
}

async function startAppServer({ runtimeDir, providerBaseUrl, appEnv = {} }) {
  const port = await getFreePort();
  const childProcess = spawn(process.execPath, [serverEntry], {
    cwd: appRoot,
    env: {
      ...process.env,
      PORT: String(port),
      RUNTIME_DIR: runtimeDir,
      PAGE_AUDIT_ALLOW_PRIVATE_HOSTS: '127.0.0.1',
      DIAGNOSES_IP_HOURLY_LIMIT: '1',
      DIAGNOSES_GLOBAL_DAILY_LIMIT: '30',
      BAILIAN_API_KEY: 'controlled-test-key',
      BAILIAN_BASE_URL: providerBaseUrl,
      DEEPSEEK_API_KEY: '',
      DEEPSEEK_BASE_URL: '',
      DEEPSEEK_ENABLED: 'true',
      DEEPSEEK_MODEL: 'controlled-model',
      DEEPSEEK_SAMPLE_CONCURRENCY: '5',
      DEEPSEEK_SAMPLE_MAX_RETRIES: '1',
      HY3_ENABLED: 'false',
      HY3_API_KEY: '',
      QWEN_ENABLED: 'false',
      QWEN_API_KEY: '',
      DOUBAO_ENABLED: 'false',
      DOUBAO_API_KEY: '',
      ARK_API_KEY: '',
      ...appEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  childProcess.stdout.on('data', (chunk) => { output += chunk; });
  childProcess.stderr.on('data', (chunk) => { output += chunk; });

  const url = `http://127.0.0.1:${port}`;
  await waitFor(async () => {
    if (childProcess.exitCode !== null) throw new Error(`app server exited early:\n${output}`);
    try {
      const response = await fetch(`${url}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }, `app server did not become ready:\n${output}`);

  return { process: childProcess, url };
}

function beginPost(baseUrl, payload) {
  const body = JSON.stringify(payload);
  const target = new URL('/api/diagnoses', baseUrl);
  let settle;
  const settled = new Promise((resolve) => { settle = resolve; });
  const request = http.request(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, (response) => {
    response.resume();
    response.on('end', () => settle());
  });
  request.on('error', () => settle());
  request.end(body);
  return { request, settled };
}

async function postJson(baseUrl, payload) {
  return postJsonAt(baseUrl, '/api/diagnoses', payload);
}

async function postJsonAt(baseUrl, pathname, payload) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('free_port_unavailable');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitFor(check, message, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

async function stopProcess(childProcess) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return;
  childProcess.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => childProcess.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000))
  ]);
  if (childProcess.exitCode === null && childProcess.signalCode === null) childProcess.kill('SIGKILL');
}
