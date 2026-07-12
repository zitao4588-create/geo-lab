import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rules = [
  ['api_key', /\bsk-[A-Za-z0-9_-]{12,}\b/gu],
  ['bearer_token', /\bBearer\s+[A-Za-z0-9._-]{12,}/gu],
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu],
  ['cloud_secret_assignment', /\b(?:BAILIAN_API_KEY|HY3_API_KEY|DOUBAO_API_KEY|ARK_API_KEY|SecretKey)\s*[:=]\s*["']?[^\s"']{8,}/gu]
];

export async function scanPaths(inputPaths) {
  const files = [];
  for (const inputPath of inputPaths) await collect(path.resolve(inputPath), files);
  const findings = [];
  for (const filename of files) {
    const stat = await lstat(filename);
    if (stat.size > 5_000_000) continue;
    const content = await readFile(filename, 'utf8').catch(() => '');
    for (const [rule, pattern] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) findings.push({ file: filename, rule });
    }
  }
  return { ok: findings.length === 0, scannedFiles: files.length, findings };
}

async function collect(target, files) {
  const stat = await lstat(target);
  if (stat.isSymbolicLink()) return;
  if (stat.isFile()) {
    files.push(target);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of await readdir(target)) await collect(path.join(target, entry), files);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['dist/client'];
  const result = await scanPaths(targets);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
