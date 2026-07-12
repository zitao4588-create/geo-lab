import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvidencePackage, renderReportHtml, renderReportMarkdown } from '../dist/server/server/exporter.js';
import { auditSubmittedPages } from '../dist/server/server/pageAudit.js';
import { buildFinalGeoReport } from '../dist/server/server/rules.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const sourceDir = path.join(repoRoot, 'outputs/h5-mvp/batch-instance-testing-20260712');
const sourceRuntime = path.join(sourceDir, 'stage-b-rerun-after-allowlist');
const sourceRun = JSON.parse(await readFile(path.join(sourceDir, 'stage-b-rerun-after-allowlist-results.json'), 'utf8'));
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/source-recognition-hardening-20260712');
const runtimeDir = path.join(outputDir, 'stage-b-runtime');
const result = {
  generatedAt: new Date().toISOString(),
  samplingMode: 'reuse_saved_real_four_provider_samples_after_page_audit_fix',
  sourceRun: 'stage-b-rerun-after-allowlist-results.json',
  newProviderCalls: 0,
  totals: { realReports: 0, reusedReports: 1, providerSamples: 0, successes: 0, failures: 0, fallbackCount: 0 },
  cases: []
};

for (const item of sourceRun.cases.filter((candidate) => candidate.execution === 'real_multi_provider')) {
  const sourceDiagnosisPath = path.join(sourceRuntime, 'diagnoses', `${item.reportId}.json`);
  const sourceEvidenceDir = path.join(sourceRuntime, 'evidence', item.reportId);
  const stored = JSON.parse(await readFile(sourceDiagnosisPath, 'utf8'));
  const samples = JSON.parse(await readFile(path.join(sourceEvidenceDir, 'samples.json'), 'utf8'));
  const providers = JSON.parse(await readFile(path.join(sourceEvidenceDir, 'providers.json'), 'utf8'));
  const pageAudit = await auditSubmittedPages(stored.input);
  const report = buildFinalGeoReport(stored.input, samples, pageAudit, providers);
  const evidenceDir = path.join(runtimeDir, 'evidence', report.id);
  await mkdir(path.join(evidenceDir, 'exports'), { recursive: true });
  await mkdir(path.join(runtimeDir, 'diagnoses'), { recursive: true });
  await writeFile(path.join(runtimeDir, 'diagnoses', `${report.id}.json`), `${JSON.stringify({ input: stored.input, report, savedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, 'samples.json'), `${JSON.stringify(samples, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, 'providers.json'), `${JSON.stringify(providers, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, 'page-audit.json'), `${JSON.stringify(pageAudit, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, 'exports', 'report.md'), renderReportMarkdown(report), 'utf8');
  await writeFile(path.join(evidenceDir, 'exports', 'report.html'), renderReportHtml(report), 'utf8');
  await writeFile(path.join(evidenceDir, 'exports', 'evidence-package.json'), `${JSON.stringify(buildEvidencePackage(stored.input, report, samples, pageAudit, providers), null, 2)}\n`, 'utf8');

  const submitted = pageAudit.targets.find((target) => target.id === 'submitted');
  const summary = {
    id: item.id,
    title: item.title,
    reportId: report.id,
    sourceReportId: item.reportId,
    providerSamples: samples.length,
    successCount: samples.filter((sample) => sample.status === 'success').length,
    failureCount: samples.filter((sample) => sample.status === 'failed').length,
    fallbackCount: item.fallbackCount,
    providerStatuses: report.aiMeta.providers,
    pageAuditScore: pageAudit.score,
    submittedSourceRelation: submitted?.sourceRelation ?? null,
    submittedScopeRelation: submitted?.scopeRelation ?? null,
    submittedMissingFacts: submitted?.missingFacts ?? [],
    confidence: report.stages.credibility.confidence,
    scoreStatus: report.stages.credibility.scoreStatus,
    displayedScore: report.stages.credibility.scoreStatus === 'available' ? report.score : null,
    correctEntityRecognitionRate: report.stages.credibility.correctEntityRecognitionRate,
    misrecognitionRate: report.stages.credibility.misrecognitionRate,
    modelConflictCount: report.stages.credibility.modelConflicts.length,
    unverifiedFacts: report.stages.credibility.unverifiedFacts
  };
  result.cases.push(summary);
  result.totals.realReports += 1;
  result.totals.providerSamples += summary.providerSamples;
  result.totals.successes += summary.successCount;
  result.totals.failures += summary.failureCount;
  result.totals.fallbackCount += summary.fallbackCount;
}

const savedS02 = sourceRun.cases.find((candidate) => candidate.id === 'S02');
if (savedS02) result.cases.push({ ...savedS02, note: '按既有约束继续复用已保存四模型证据，本轮新增调用为 0。' });
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'stage-b-results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ totals: result.totals, cases: result.cases.map(({ id, scoreStatus, displayedScore, submittedSourceRelation, submittedScopeRelation }) => ({ id, scoreStatus, displayedScore, submittedSourceRelation, submittedScopeRelation })) }, null, 2));
