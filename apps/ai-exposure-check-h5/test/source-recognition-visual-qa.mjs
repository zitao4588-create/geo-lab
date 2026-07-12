import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const runtimeDir = path.resolve(process.env.SOURCE_RECOGNITION_RUNTIME_DIR || '/private/tmp/source-recognition-hardening-runtime');
const outputDir = path.resolve(process.cwd(), '../../outputs/h5-mvp/source-recognition-hardening-20260712');
const screenshotDir = path.join(outputDir, 'screenshots');
const port = 8796;
const baseUrl = `http://127.0.0.1:${port}`;
const cases = [
  ['p01-official-product', 'diag_source_p01', /ES-LM55/u],
  ['p02-model-conflict', 'diag_source_p02', /错误认知|型号.*冲突/u],
  ['l01-official-entry-partial', 'diag_source_l01', /页面不足以证明当前业务范围|西安/u],
  ['l03-national-home-mismatch', 'diag_source_l03', /暂不评分|暂不展示总分/u],
  ['e02-unrelated-source', 'diag_source_e02', /暂不评分|暂不展示总分/u],
  ['l04-unsupported-claims', 'diag_source_l04', /百分百除菌|仍待核验/u]
];
const viewports = [{ width: 390, height: 844 }, { width: 1440, height: 1000 }];
const checks = [];
await mkdir(screenshotDir, { recursive: true });

const server = spawn(process.execPath, ['dist/server/server/index.js'], {
  cwd: process.cwd(), env: { ...process.env, PORT: String(port), RUNTIME_DIR: runtimeDir }, stdio: ['ignore', 'pipe', 'pipe']
});
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

try {
  await waitForHealth();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, reportId, signal] of cases) {
      for (const viewport of viewports) await inspect(name, reportId, signal, viewport, browser);
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
}

const failures = checks.filter((item) => item.overflow || item.errors.length > 0 || !item.hasConfirmed || !item.hasUnverified || !item.hasConfidence || !item.hasActions || !item.caseSignal);
await writeFile(path.join(outputDir, 'visual-qa.json'), `${JSON.stringify({ baseUrl, checks, failureCount: failures.length }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ checks: checks.length, failures: failures.length }, null, 2));
if (failures.length > 0) process.exitCode = 1;

async function inspect(name, reportId, signal, viewport, browser) {
  const page = await browser.newPage({ viewportSize: viewport });
  const errors = [];
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  await page.goto(`${baseUrl}/?report=${reportId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.report-cover');
  await page.waitForTimeout(1000);
  const body = await page.locator('body').innerText();
  checks.push({
    name, reportId, viewport,
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    errors,
    hasConfirmed: await page.getByText('已确认', { exact: true }).isVisible(),
    hasUnverified: await page.getByText('仍待核验', { exact: true }).isVisible(),
    hasConfidence: await page.locator('.confidence-banner').isVisible(),
    hasActions: await page.locator('.next-action-list').isVisible(),
    caseSignal: signal.test(body)
  });
  await page.screenshot({ path: path.join(screenshotDir, `${name}-${viewport.width}x${viewport.height}.png`), fullPage: true });
  await page.close();
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('source_recognition_visual_server_timeout');
}
