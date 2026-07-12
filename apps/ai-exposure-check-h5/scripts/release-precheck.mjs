import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { scanPaths } from './scan-release-artifacts.mjs';

const root = process.cwd();
const required = [
  'dist/client/index.html',
  'dist/client/privacy.html',
  'dist/client/terms.html',
  'dist/client/ai-exposure-check.html',
  'dist/client/features/index.html',
  'dist/client/faq/index.html',
  'dist/client/geo-case/index.html',
  'dist/client/robots.txt',
  'dist/client/sitemap.xml',
  'dist/client/llms.txt',
  'dist/server/server/index.js'
];
const checks = [];
for (const relative of required) {
  try {
    await access(path.join(root, relative));
    checks.push({ check: `exists:${relative}`, ok: true });
  } catch {
    checks.push({ check: `exists:${relative}`, ok: false });
  }
}
const index = await readFile(path.join(root, 'dist/client/index.html'), 'utf8').catch(() => '');
checks.push({ check: 'canonical:https://exposure.playgamelab.cn/', ok: index.includes('https://exposure.playgamelab.cn/') });
const scan = await scanPaths([path.join(root, 'dist/client')]);
checks.push({ check: 'client_bundle_secret_scan', ok: scan.ok, detail: { scannedFiles: scan.scannedFiles, findingRules: scan.findings.map((item) => item.rule) } });
const result = { ok: checks.every((item) => item.ok), checks };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
