import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ZodError } from 'zod';
import { diagnosisInputSchema } from './validation.js';
import { buildFinalGeoReport, buildPromptUniverse } from './rules.js';
import { getDeepSeekRuntime, polishFinalReportWithDeepSeek, sampleAiProviders, SamplingUnavailableError } from './deepseek.js';
import { auditSubmittedPages } from './pageAudit.js';
import {
  buildDiagnosisRequestFingerprint,
  readDiagnosis,
  readDiagnosisByClientRequestId,
  readEvidenceIndex,
  readExportFile,
  saveDiagnosis
} from './storage.js';
import type { DiagnosisInput, DiagnosisReport } from '../shared/types.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const clientDist = path.resolve(process.cwd(), 'dist/client');
const hourlyIpLimit = readPositiveInteger(process.env.DIAGNOSES_IP_HOURLY_LIMIT, 1);
const globalDailyLimit = readPositiveInteger(process.env.DIAGNOSES_GLOBAL_DAILY_LIMIT, 30);
const hourMs = 60 * 60 * 1000;

app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '64kb' }));

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const hourlyIpRequests = new Map<string, RateLimitEntry>();
interface InFlightDiagnosis {
  requestFingerprint: string;
  promise: Promise<DiagnosisReport>;
}

const inFlightDiagnoses = new Map<string, InFlightDiagnosis>();
let globalDailyRequests: RateLimitEntry = {
  count: 0,
  resetAt: nextUtcDayStart(Date.now())
};

function consumeDiagnosisQuota(req: express.Request, res: express.Response) {
  const now = Date.now();
  resetExpiredLimits(now);
  pruneExpiredIpEntries(now);

  const ip = getClientIp(req);
  const ipEntry = hourlyIpRequests.get(ip) ?? { count: 0, resetAt: now + hourMs };
  if (ipEntry.count >= hourlyIpLimit) {
    sendRateLimit(res, ipEntry.resetAt, '本小时免费体检次数已用完，请稍后再试或扫码预约人工解读。');
    return false;
  }

  if (globalDailyRequests.count >= globalDailyLimit) {
    sendRateLimit(res, globalDailyRequests.resetAt, '今天免费体检名额已用完，请明天再试或扫码预约人工解读。');
    return false;
  }

  ipEntry.count += 1;
  hourlyIpRequests.set(ip, ipEntry);
  globalDailyRequests.count += 1;
  return true;
}

function resetExpiredLimits(now: number) {
  if (now >= globalDailyRequests.resetAt) {
    globalDailyRequests = {
      count: 0,
      resetAt: nextUtcDayStart(now)
    };
  }
}

function pruneExpiredIpEntries(now: number) {
  for (const [ip, entry] of hourlyIpRequests) {
    if (now >= entry.resetAt) {
      hourlyIpRequests.delete(ip);
    }
  }
}

function sendRateLimit(res: express.Response, resetAt: number, message: string) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: 'rate_limited',
    message
  });
}

function getClientIp(req: express.Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];
  return (firstForwardedIp || req.ip || req.socket.remoteAddress || 'unknown').trim();
}

function nextUtcDayStart(now: number) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

app.get('/api/health', (_req, res) => {
  const runtime = getDeepSeekRuntime();
  res.json({
    ok: true,
    service: 'ai-exposure-check-h5',
    model: runtime.model,
    samplingReady: runtime.hasApiKey,
    providers: runtime.providers
  });
});

app.post('/api/diagnoses', async (req, res, next) => {
  let runningDiagnosis: Promise<DiagnosisReport> | null = null;
  let clientRequestId = '';
  let requestFingerprint = '';

  try {
    const input = diagnosisInputSchema.parse(req.body);
    clientRequestId = input.clientRequestId || '';

    if (clientRequestId) {
      requestFingerprint = buildDiagnosisRequestFingerprint(input);
      const existingDiagnosis = await readDiagnosisByClientRequestId(clientRequestId, requestFingerprint);
      if (existingDiagnosis.status === 'conflict') {
        sendIdempotencyConflict(res);
        return;
      }
      if (existingDiagnosis.status === 'found') {
        res.status(200).json({ report: existingDiagnosis.report });
        return;
      }

      const inFlightDiagnosis = inFlightDiagnoses.get(clientRequestId);
      if (inFlightDiagnosis) {
        if (inFlightDiagnosis.requestFingerprint !== requestFingerprint) {
          sendIdempotencyConflict(res);
          return;
        }
        const report = await inFlightDiagnosis.promise;
        res.status(200).json({ report });
        return;
      }
    }

    if (!consumeDiagnosisQuota(req, res)) return;

    runningDiagnosis = generateDiagnosis(input);
    if (clientRequestId) {
      inFlightDiagnoses.set(clientRequestId, {
        requestFingerprint,
        promise: runningDiagnosis
      });
    }

    const report = await runningDiagnosis;
    res.status(201).json({ report });
  } catch (error) {
    next(error);
  } finally {
    if (clientRequestId && runningDiagnosis && inFlightDiagnoses.get(clientRequestId)?.promise === runningDiagnosis) {
      inFlightDiagnoses.delete(clientRequestId);
    }
  }
});

function sendIdempotencyConflict(res: express.Response) {
  res.status(409).json({
    error: 'idempotency_conflict',
    message: '这次提交的请求编号已用于另一份体检，请返回后重新提交。'
  });
}

async function generateDiagnosis(input: DiagnosisInput) {
  const prompts = buildPromptUniverse(input);
  const pageAudit = await auditSubmittedPages(input);
  const { samples, providerStatuses } = await sampleAiProviders(prompts);
  const successfulSamples = samples.filter((sample) => sample.status === 'success');

  if (successfulSamples.length === 0) {
    throw new SamplingUnavailableError('DeepSeek 本次采样全部失败，无法生成最终 GEO 分析报告');
  }

  const baseReport = buildFinalGeoReport(input, samples, pageAudit, providerStatuses);
  const report = await polishFinalReportWithDeepSeek(input, baseReport);
  await saveDiagnosis(input, report, samples, pageAudit, providerStatuses);
  return report;
}

app.get('/api/diagnoses/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^diag_[a-z0-9_]+$/u.test(id)) {
    res.status(400).json({ error: 'invalid_id', message: '报告编号格式不正确' });
    return;
  }

  const report = await readDiagnosis(id);
  if (!report) {
    res.status(404).json({ error: 'not_found', message: '没有找到这份体检报告' });
    return;
  }

  res.json({ report });
});

app.get('/api/diagnoses/:id/evidence', async (req, res) => {
  const id = req.params.id;
  if (!/^diag_[a-z0-9_]+$/u.test(id)) {
    res.status(400).json({ error: 'invalid_id', message: '报告编号格式不正确' });
    return;
  }

  const evidence = await readEvidenceIndex(id);
  if (!evidence) {
    res.status(404).json({ error: 'not_found', message: '没有找到这份报告的证据索引' });
    return;
  }

  res.json({ evidence });
});

app.get('/api/diagnoses/:id/export/:format', async (req, res) => {
  const id = req.params.id;
  const format = req.params.format;
  if (!/^diag_[a-z0-9_]+$/u.test(id)) {
    res.status(400).json({ error: 'invalid_id', message: '报告编号格式不正确' });
    return;
  }
  if (format !== 'markdown' && format !== 'html' && format !== 'evidence-package') {
    res.status(400).json({ error: 'invalid_format', message: '导出格式不支持' });
    return;
  }

  const content = await readExportFile(id, format);
  if (!content) {
    res.status(404).json({ error: 'not_found', message: '没有找到这份报告的导出文件' });
    return;
  }

  if (format === 'html') {
    res.type('html').send(content);
    return;
  }
  if (format === 'evidence-package') {
    res.type('json').send(content);
    return;
  }
  res.type('text/markdown; charset=utf-8').send(content);
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: error.errors[0]?.message || '请检查填写内容'
    });
    return;
  }

  if (error instanceof SamplingUnavailableError) {
    res.status(503).json({
      error: 'sampling_unavailable',
      message: error.message
    });
    return;
  }

  res.status(500).json({
    error: 'internal_error',
    message: '体检报告生成失败，请稍后再试'
  });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`AI曝光体检 H5 API listening on http://127.0.0.1:${port}`);
});
