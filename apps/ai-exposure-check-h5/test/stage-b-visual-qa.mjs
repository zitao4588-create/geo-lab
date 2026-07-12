import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '../..');
const outputDir = path.join(repoRoot, 'outputs/h5-mvp/batch-instance-testing-20260712');
const runtimeDir = path.join(outputDir, 'stage-b-runtime');
const screenshotDir = path.join(outputDir, 'screenshots');
const reportId = 'diag_mrh25adf_p7j0ss';
const port = 8795;
const baseUrl = `http://127.0.0.1:${port}`;
await mkdir(screenshotDir, { recursive: true });

const server = spawn(process.execPath, ['dist/server/server/index.js'], {
  cwd: appRoot,
  env: { ...process.env, PORT: String(port), RUNTIME_DIR: runtimeDir },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

const checks = [];
try {
  await waitForHealth();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const page = await browser.newPage({ viewportSize: viewport });
      const errors = [];
      page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`console:${message.type()}:${message.text()}`); });
      page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
      await page.goto(`${baseUrl}/?report=${reportId}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.report-cover');
      await page.waitForTimeout(1000);
      const body = await page.locator('body').innerText();
      const check = {
        reportId,
        viewport,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
        errors,
        hasLowConfidence: /低置信度/u.test(body),
        hasWithheldScore: /暂不评分|暂不展示总分/u.test(body),
        hasDoubaoSuccess: /豆包.*10\/10/u.test(body),
        hasDeepseekFailure: /DeepSeek.*失败 0\/10/u.test(body),
        hasHy3Failure: /混元.*失败 0\/10/u.test(body),
        hasQwenFailure: /千问.*失败 0\/10/u.test(body),
        hasConfirmed: await page.getByText('已确认', { exact: true }).isVisible(),
        hasUnverified: await page.getByText('仍待核验', { exact: true }).isVisible()
      };
      checks.push(check);
      await page.screenshot({ path: path.join(screenshotDir, `stage-b-real-partial-${viewport.width}x${viewport.height}.png`), fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
}

const failures = checks.filter((item) => item.overflow || item.errors.length || !item.hasLowConfidence || !item.hasWithheldScore || !item.hasDoubaoSuccess || !item.hasDeepseekFailure || !item.hasHy3Failure || !item.hasQwenFailure || !item.hasConfirmed || !item.hasUnverified);
await writeFile(path.join(outputDir, 'stage-b-visual-qa.json'), `${JSON.stringify({ baseUrl, checks, failureCount: failures.length }, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'stage-b-visual-qa.md'), markdown(checks), 'utf8');
console.log(JSON.stringify({ checks: checks.length, failures: failures.length }, null, 2));
if (failures.length) process.exitCode = 1;

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('stage_b_visual_server_timeout');
}

function markdown(items) {
  return `# 阶段 B 真实报告视觉验收\n\n| 视口 | 溢出 | 控制台问题 | 低置信度 | 暂停总分 | 豆包成功 | 三家失败可见 | 已确认/待核验 |\n| --- | --- | ---: | --- | --- | --- | --- | --- |\n${items.map((item) => `| ${item.viewport.width}×${item.viewport.height} | ${item.overflow ? '是' : '否'} | ${item.errors.length} | ${item.hasLowConfidence ? '是' : '否'} | ${item.hasWithheldScore ? '是' : '否'} | ${item.hasDoubaoSuccess ? '是' : '否'} | ${item.hasDeepseekFailure && item.hasHy3Failure && item.hasQwenFailure ? '是' : '否'} | ${item.hasConfirmed && item.hasUnverified ? '是' : '否'} |`).join('\n')}\n`;
}
