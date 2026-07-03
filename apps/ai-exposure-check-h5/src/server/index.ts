import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ZodError } from 'zod';
import { diagnosisInputSchema } from './validation.js';
import { buildFinalGeoReport, buildPromptUniverse } from './rules.js';
import { getDeepSeekRuntime, polishFinalReportWithDeepSeek, sampleAiProviders, SamplingUnavailableError } from './deepseek.js';
import { auditSubmittedPages } from './pageAudit.js';
import { readDiagnosis, readEvidenceIndex, readExportFile, saveDiagnosis } from './storage.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const clientDist = path.resolve(process.cwd(), 'dist/client');

app.use(express.json({ limit: '64kb' }));

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
  try {
    const input = diagnosisInputSchema.parse(req.body);
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
    res.status(201).json({ report });
  } catch (error) {
    next(error);
  }
});

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
