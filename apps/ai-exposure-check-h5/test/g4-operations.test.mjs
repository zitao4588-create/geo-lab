import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDeepSeekRuntime, sampleAiProviders } from '../dist/server/server/deepseek.js';
import { summarizeOperation } from '../dist/server/server/operations.js';
import { PersistentRateLimiter } from '../dist/server/server/rateLimiter.js';
import { scanPaths } from '../scripts/scan-release-artifacts.mjs';

test('provider health separates configured credentials, sampling permission, cost boundary, and real success', () => {
  withEnv({
    HY3_ENABLED: 'true', HY3_API_KEY: 'controlled-key', HY3_COST_GUARD_CONFIRMED: 'false',
    DOUBAO_ENABLED: 'true', DOUBAO_API_KEY: 'controlled-key', DOUBAO_COST_GUARD_CONFIRMED: 'true', DOUBAO_COST_GUARD_CONFIRMED_UNTIL: '2099-01-01T00:00:00Z',
    DEEPSEEK_ENABLED: 'false', QWEN_ENABLED: 'false'
  }, () => {
    const runtime = getDeepSeekRuntime();
    const hy3 = runtime.providers.find((item) => item.provider === 'hy3');
    const doubao = runtime.providers.find((item) => item.provider === 'doubao');
    assert.equal(hy3.configured, true);
    assert.equal(hy3.samplingAllowed, false);
    assert.equal(hy3.costGuard, 'unknown');
    assert.equal(hy3.status, 'unavailable');
    assert.equal(doubao.configured, true);
    assert.equal(doubao.samplingAllowed, true);
    assert.equal(doubao.costGuard, 'manually_confirmed');
    assert.equal(doubao.status, 'ready');
    assert.equal(runtime.configuredProviderCount, 2);
    assert.equal(runtime.samplingAllowedProviderCount, 1);
  });
});

test('unknown cost guards fail closed before any provider request', async () => {
  let fetchCalls = 0;
  await withEnvAsync({
    BAILIAN_API_KEY: '', DEEPSEEK_ENABLED: 'false', QWEN_ENABLED: 'false',
    HY3_ENABLED: 'true', HY3_API_KEY: 'controlled-key', HY3_COST_GUARD_CONFIRMED: 'false',
    DOUBAO_ENABLED: 'true', DOUBAO_API_KEY: 'controlled-key', DOUBAO_COST_GUARD_CONFIRMED: 'true', DOUBAO_COST_GUARD_CONFIRMED_UNTIL: '2020-01-01T00:00:00Z'
  }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must_not_fetch'); };
    try {
      await assert.rejects(() => sampleAiProviders([{ id: 'P001', category: 'brand', prompt: 'fixture', targetFact: 'fixture' }]), /配置与成本保护门/u);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  assert.equal(fetchCalls, 0);
});

test('operation summary records provider rates, failure types, fallback, percentiles, slowest prompt, and phase durations without prompt text', () => {
  const samples = [
    sample('deepseek', 'P001', 100, 'success'),
    sample('deepseek', 'P002', 300, 'success', { model: 'fallback-model', fallbackUsed: true }),
    sample('deepseek', 'P003', 500, 'failed', { error: 'controlled timeout' }),
    sample('hy3', 'P001', 200, 'failed', { error: '401 access denied' })
  ];
  const summary = summarizeOperation({ reportId: 'diag_controlled', samples, pageAuditDurationMs: 44, samplingDurationMs: 600, totalDurationMs: 710 });
  const deepseek = summary.providers.find((item) => item.provider === 'deepseek');
  assert.equal(deepseek.successRate, 2 / 3);
  assert.equal(deepseek.fallbackCount, 1);
  assert.equal(deepseek.p50LatencyMs, 300);
  assert.equal(deepseek.p95LatencyMs, 500);
  assert.equal(deepseek.slowestPromptId, 'P003');
  assert.deepEqual(deepseek.failureTypes, { timeout: 1 });
  assert.equal(summary.pageAuditDurationMs, 44);
  assert.equal(summary.samplingDurationMs, 600);
  assert.equal(summary.totalDurationMs, 710);
  assert.doesNotMatch(JSON.stringify(summary), /问题全文|prompt text/u);
});

test('rate limits persist across restart and store only hashed client identifiers', async () => {
  const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-rate-limit-'));
  const first = new PersistentRateLimiter({ runtimeDir, hourlyIpLimit: 1, globalDailyLimit: 30, now: () => 1_700_000_000_000 });
  assert.equal((await first.consume('198.51.100.42')).allowed, true);
  const restarted = new PersistentRateLimiter({ runtimeDir, hourlyIpLimit: 1, globalDailyLimit: 30, now: () => 1_700_000_001_000 });
  const denied = await restarted.consume('198.51.100.42');
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, 'ip_hourly');
  const file = await readFile(path.join(runtimeDir, 'rate-limits.json'), 'utf8');
  assert.doesNotMatch(file, /198\.51\.100\.42/u);
  assert.match(file, /[a-f0-9]{64}/u);
});

test('release artifact scan reports secret classes without echoing secret values', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aiec-secret-scan-'));
  const secret = 'sk-controlled-super-secret-value';
  await (await import('node:fs/promises')).writeFile(path.join(root, 'bundle.js'), `window.value="${secret}";`, 'utf8');
  const result = await scanPaths([root]);
  assert.equal(result.ok, false);
  assert.equal(result.findings[0].rule, 'api_key');
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret, 'u'));
});

function sample(provider, promptId, latencyMs, status, overrides = {}) {
  return {
    prompt: { id: promptId, category: 'brand', prompt: '问题全文不得进入观测摘要', targetFact: 'fixture' },
    provider, model: 'primary-model', status, sampledAt: '2026-07-12T00:00:00.000Z', latencyMs,
    ...(status === 'success' ? { answer: 'fixture answer' } : { error: 'controlled failure' }),
    ...overrides
  };
}

function withEnv(values, action) {
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { action(); } finally {
    for (const [key, value] of Object.entries(before)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}

async function withEnvAsync(values, action) {
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { await action(); } finally {
    for (const [key, value] of Object.entries(before)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}
