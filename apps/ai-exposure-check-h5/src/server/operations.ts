import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AiProvider, AiSample } from '../shared/types.js';

export interface OperationSummary {
  reportId: string;
  recordedAt: string;
  pageAuditDurationMs: number;
  samplingDurationMs: number;
  totalDurationMs: number;
  providers: Array<{
    provider: AiProvider;
    models: string[];
    promptCount: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    fallbackCount: number;
    failureTypes: Record<string, number>;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    slowestPromptId?: string;
    lastRealSuccessAt?: string;
  }>;
}

export function summarizeOperation(input: {
  reportId: string;
  samples: AiSample[];
  pageAuditDurationMs: number;
  samplingDurationMs: number;
  totalDurationMs: number;
  recordedAt?: string;
}): OperationSummary {
  const providers = [...new Set(input.samples.map((sample) => sample.provider))].map((provider) => {
    const samples = input.samples.filter((sample) => sample.provider === provider);
    const successful = samples.filter((sample) => sample.status === 'success');
    const latencies = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);
    const slowest = [...samples].sort((a, b) => b.latencyMs - a.latencyMs)[0];
    const failureTypes = samples.filter((sample) => sample.status !== 'success').reduce<Record<string, number>>((counts, sample) => {
      const type = sample.failureType ?? classifyFailure(sample.error ?? 'unknown');
      counts[type] = (counts[type] ?? 0) + 1;
      return counts;
    }, {});
    return {
      provider,
      models: [...new Set(samples.map((sample) => sample.model))],
      promptCount: samples.length,
      successCount: successful.length,
      failureCount: samples.length - successful.length,
      successRate: samples.length === 0 ? 0 : successful.length / samples.length,
      fallbackCount: samples.filter((sample) => sample.fallbackUsed).length,
      failureTypes,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      slowestPromptId: slowest?.prompt.id,
      lastRealSuccessAt: successful.map((sample) => sample.sampledAt).sort().at(-1)
    };
  });
  return {
    reportId: input.reportId,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    pageAuditDurationMs: input.pageAuditDurationMs,
    samplingDurationMs: input.samplingDurationMs,
    totalDurationMs: input.totalDurationMs,
    providers
  };
}

export async function recordOperation(summary: OperationSummary, runtimeDir = defaultRuntimeDir()) {
  const operationsDir = path.join(runtimeDir, 'operations');
  await mkdir(operationsDir, { recursive: true });
  const target = path.join(operationsDir, 'latest.json');
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(summary, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, target);
}

export async function readLatestOperation(runtimeDir = defaultRuntimeDir()): Promise<OperationSummary | null> {
  try {
    return JSON.parse(await readFile(path.join(runtimeDir, 'operations', 'latest.json'), 'utf8')) as OperationSummary;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) return null;
  return values[Math.max(0, Math.ceil(values.length * quantile) - 1)] ?? null;
}

function classifyFailure(value: string) {
  if (/timeout|timed out|abort/iu.test(value)) return 'timeout';
  if (/quota|free.?tier|allocation|balance|billing|exhaust|resource.?package/iu.test(value)) return 'quota_or_billing';
  if (/429|rate.?limit/iu.test(value)) return 'rate_limit';
  if (/401|403|access|auth|permission|allowlist/iu.test(value)) return 'authorization';
  if (/network|socket|connect|dns|fetch failed/iu.test(value)) return 'network';
  return 'provider_error';
}

function defaultRuntimeDir() {
  return path.resolve(process.cwd(), process.env.RUNTIME_DIR || 'runtime');
}
