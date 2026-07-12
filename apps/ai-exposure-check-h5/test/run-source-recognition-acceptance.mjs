import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSubmittedPages } from '../dist/server/server/pageAudit.js';
import { batchCases } from './batch-instance-cases.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/source-recognition-hardening-20260712');
const ids = ['P01', 'P02', 'L01', 'L03'];
const results = [];

for (const id of ids) {
  const item = batchCases.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`missing_case:${id}`);
  const audit = await auditSubmittedPages(item.input);
  const submitted = audit.targets.find((target) => target.id === 'submitted');
  results.push({
    id,
    title: item.title,
    inputUrl: item.input.links,
    score: audit.score,
    summary: audit.summary,
    submitted: submitted ? {
      url: submitted.url,
      status: submitted.status,
      httpStatus: submitted.httpStatus,
      title: submitted.title,
      canonicalUrl: submitted.canonicalUrl,
      sourceRelation: submitted.sourceRelation,
      scopeRelation: submitted.scopeRelation,
      matchedFacts: submitted.matchedFacts,
      missingFacts: submitted.missingFacts,
      notes: submitted.notes
    } : null
  });
}

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'page-audit-live.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  cases: results
}, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(results.map(({ id, score, submitted }) => ({ id, score, submitted })), null, 2));
