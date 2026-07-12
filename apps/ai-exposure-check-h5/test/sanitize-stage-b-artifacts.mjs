import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeProviderError } from '../dist/server/server/deepseek.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/batch-instance-testing-20260712');
const runtimeDir = path.join(outputDir, 'stage-b-runtime');
const run = JSON.parse(await readFile(path.join(outputDir, 'stage-b-run-results.json'), 'utf8'));
let changed = 0;

for (const item of run.cases.filter((candidate) => candidate.execution === 'real_multi_provider')) {
  const samplesPath = path.join(runtimeDir, 'evidence', item.reportId, 'samples.json');
  const samples = JSON.parse(await readFile(samplesPath, 'utf8'));
  for (const sample of samples) {
    if (!sample.error) continue;
    const sanitized = sanitizeProviderError(sample.error);
    if (sanitized !== sample.error) changed += 1;
    sample.error = sanitized;
  }
  await writeFile(samplesPath, `${JSON.stringify(samples, null, 2)}\n`, 'utf8');
  const sourceMapPath = path.join(runtimeDir, 'evidence', item.reportId, 'source-map.md');
  const sourceMap = await readFile(sourceMapPath, 'utf8');
  const sanitizedSourceMap = sourceMap.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[redacted_ip]');
  if (sanitizedSourceMap !== sourceMap) changed += 1;
  await writeFile(sourceMapPath, sanitizedSourceMap, 'utf8');
}

console.log(JSON.stringify({ changed }, null, 2));
