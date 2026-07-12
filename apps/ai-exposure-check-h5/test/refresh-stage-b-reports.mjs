import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFinalGeoReport } from '../dist/server/server/rules.js';
import { buildEvidencePackage, renderReportHtml, renderReportMarkdown } from '../dist/server/server/exporter.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/batch-instance-testing-20260712');
const runtimeDir = path.join(outputDir, 'stage-b-runtime');
const run = JSON.parse(await readFile(path.join(outputDir, 'stage-b-run-results.json'), 'utf8'));
const refreshed = [];

for (const item of run.cases.filter((candidate) => candidate.execution === 'real_multi_provider')) {
  const diagnosisPath = path.join(runtimeDir, 'diagnoses', `${item.reportId}.json`);
  const evidenceDir = path.join(runtimeDir, 'evidence', item.reportId);
  const stored = JSON.parse(await readFile(diagnosisPath, 'utf8'));
  const samples = JSON.parse(await readFile(path.join(evidenceDir, 'samples.json'), 'utf8'));
  const providerStatuses = JSON.parse(await readFile(path.join(evidenceDir, 'providers.json'), 'utf8'));
  const pageAudit = JSON.parse(await readFile(path.join(evidenceDir, 'page-audit.json'), 'utf8'));
  const report = buildFinalGeoReport(stored.input, samples, pageAudit, providerStatuses);
  report.id = item.reportId;
  report.generatedAt = stored.report.generatedAt;
  report.exports = stored.report.exports;
  await writeFile(diagnosisPath, `${JSON.stringify({ ...stored, report }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(evidenceDir, 'exports', 'report.md'), renderReportMarkdown(report), 'utf8');
  await writeFile(path.join(evidenceDir, 'exports', 'report.html'), renderReportHtml(report), 'utf8');
  await writeFile(
    path.join(evidenceDir, 'exports', 'evidence-package.json'),
    `${JSON.stringify(buildEvidencePackage(stored.input, report, samples, pageAudit, providerStatuses), null, 2)}\n`,
    'utf8'
  );
  refreshed.push({ reportId: item.reportId, scoreStatus: report.stages.credibility.scoreStatus, summary: report.summary });
}

console.log(JSON.stringify({ refreshed }, null, 2));
