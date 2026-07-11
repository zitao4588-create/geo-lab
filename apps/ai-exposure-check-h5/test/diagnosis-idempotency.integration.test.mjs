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
});

test('default 10 prompt diagnosis uses five concurrent samples and skips optional polish', async (context) => {
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
  assert.equal(health.polishEnabled, false);

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
  assert.equal(provider.callCount, 10, 'default path should not add a report-polish model call');
  assert.equal(provider.peakConcurrency, 5);
  assert.ok(durationMs < 1_500, `controlled 10-prompt run took ${durationMs}ms`);
  context.diagnostic(`controlled 10-prompt wall time: ${durationMs}ms`);
});

test('DeepSeek, Hy3, and Qwen sample in parallel with provider-specific non-thinking parameters', async (context) => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-multi-provider-'));
  const provider = await startFakeOpenAiServer({ delayMs: 200 });
  const appServer = await startAppServer({
    runtimeDir,
    providerBaseUrl: provider.baseUrl,
    appEnv: {
      HY3_API_KEY: 'controlled-hy3-key',
      HY3_BASE_URL: provider.baseUrl,
      HY3_MODEL: 'controlled-hy3',
      HY3_SAMPLE_CONCURRENCY: '4',
      HY3_SAMPLE_MAX_RETRIES: '0',
      QWEN_API_KEY: 'controlled-qwen-key',
      QWEN_BASE_URL: provider.baseUrl,
      QWEN_MODEL: 'controlled-qwen',
      QWEN_SAMPLE_CONCURRENCY: '4',
      QWEN_SAMPLE_MAX_RETRIES: '0'
    }
  });

  context.after(async () => {
    await stopProcess(appServer.process);
    await provider.close();
  });

  const healthResponse = await fetch(`${appServer.url}/api/health`);
  const health = await healthResponse.json();
  assert.equal(health.configuredProviderCount, 3);

  const payload = {
    ...buildPayload('req_controlled_multi_provider_01'),
    samplePrompts: Array.from({ length: 5 }, (_, index) => `第 ${index + 1} 条多平台采样问题是什么？`)
  };
  const startedAt = Date.now();
  const result = await postJson(appServer.url, payload);
  const durationMs = Date.now() - startedAt;

  assert.equal(result.status, 201);
  assert.equal(result.body.report.aiMeta.promptCount, 15);
  assert.equal(result.body.report.aiMeta.successCount, 15);
  assert.equal(result.body.report.stages.promptUniverse.prompts.length, 5);
  assert.equal(provider.callCount, 15);
  assert.equal(provider.peakConcurrency, 13);
  assert.ok(durationMs < 1_500, `controlled multi-provider run took ${durationMs}ms`);

  const statusByProvider = Object.fromEntries(result.body.report.aiMeta.providers.map((status) => [status.provider, status]));
  assert.equal(statusByProvider.deepseek.status, 'sampled');
  assert.equal(statusByProvider.hy3.status, 'sampled');
  assert.equal(statusByProvider.qwen.status, 'sampled');

  const deepseekRequest = provider.requests.find((request) => request.model === 'controlled-model');
  const hy3Request = provider.requests.find((request) => request.model === 'controlled-hy3');
  const qwenRequest = provider.requests.find((request) => request.model === 'controlled-qwen');
  assert.deepEqual(deepseekRequest.thinking, { type: 'disabled' });
  assert.deepEqual(hy3Request.thinking, { type: 'disabled' });
  assert.equal(qwenRequest.enable_thinking, false);
  assert.equal(qwenRequest.thinking, undefined);
  context.diagnostic(`controlled three-provider wall time: ${durationMs}ms`);
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

function buildPayload(clientRequestId) {
  return {
    businessName: '请求恢复受控测试',
    description: '验证报告响应丢失后能恢复同一份结果',
    links: '',
    industry: '软件工具',
    city: '西安',
    targetCustomers: '需要验证提交可靠性的测试人员',
    competitors: '',
    contact: '',
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
      DIAGNOSES_IP_HOURLY_LIMIT: '1',
      DIAGNOSES_GLOBAL_DAILY_LIMIT: '30',
      DEEPSEEK_API_KEY: 'controlled-test-key',
      DEEPSEEK_BASE_URL: providerBaseUrl,
      DEEPSEEK_MODEL: 'controlled-model',
      DEEPSEEK_SAMPLE_CONCURRENCY: '5',
      DEEPSEEK_SAMPLE_MAX_RETRIES: '1',
      DEEPSEEK_POLISH_ENABLED: 'false',
      HY3_API_KEY: '',
      QWEN_API_KEY: '',
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
  const response = await fetch(`${baseUrl}/api/diagnoses`, {
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
