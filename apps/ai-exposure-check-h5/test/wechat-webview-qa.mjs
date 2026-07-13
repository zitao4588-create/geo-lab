import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startFakeOpenAiServer } from './support/fake-openai-server.mjs';

const appRoot = path.resolve(import.meta.dirname, '..');
const runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'aiec-wechat-webview-'));
const provider = await startFakeOpenAiServer({ delayMs: 30 });
const port = await getFreePort();
const appProcess = spawn(process.execPath, ['dist/server/server/index.js'], {
  cwd: appRoot,
  env: {
    ...process.env,
    PORT: String(port),
    RUNTIME_DIR: runtimeDir,
    DIAGNOSES_IP_HOURLY_LIMIT: '10',
    DIAGNOSES_GLOBAL_DAILY_LIMIT: '30',
    BAILIAN_API_KEY: 'controlled-browser-key',
    BAILIAN_BASE_URL: provider.baseUrl,
    DEEPSEEK_ENABLED: 'true',
    DEEPSEEK_MODEL: 'controlled-browser-model',
    DEEPSEEK_SAMPLE_CONCURRENCY: '5',
    DEEPSEEK_SAMPLE_MAX_RETRIES: '0',
    HY3_ENABLED: 'false',
    HY3_API_KEY: '',
    QWEN_ENABLED: 'false',
    QWEN_API_KEY: '',
    DOUBAO_ENABLED: 'false',
    DOUBAO_API_KEY: '',
    WECHAT_JSSDK_APP_ID: '',
    WECHAT_JSSDK_APP_SECRET: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

const baseUrl = `http://127.0.0.1:${port}`;
await waitForHealth(baseUrl);
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  const ios = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50'
  });
  const page = await ios.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByText('1 个模型可参与真实采样').waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light');
  await page.getByRole('button', { name: '免费测一次' }).click();
  assert.equal(await page.evaluate(() => history.state?.screen), 'form');
  await page.locator('#field-businessName input').fill('微信 WebView 受控测试');
  await page.locator('#field-description input').fill('验证微信内返回、恢复、复制与动态模型文案');
  await page.locator('#field-industry input').fill('软件工具');
  await page.locator('#field-city input').fill('西安');
  await page.locator('#field-targetCustomers input').fill('需要微信内查看报告的测试人员');
  await page.getByRole('button', { name: '生成 GEO 分析报告' }).click();
  await page.getByRole('heading', { name: 'GEO 分析成果报告' }).waitFor({ timeout: 20_000 });
  assert.match(page.url(), /\?report=diag_/u);
  assert.equal(await page.evaluate(() => history.state?.screen), 'result');
  await page.getByText(/1 个模型真实采样/u).first().waitFor();
  assert.equal(await hasHorizontalOverflow(page), false);
  const reportUrl = page.url();

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'GEO 分析成果报告' }).waitFor();
  assert.equal(page.url(), reportUrl);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  });
  await page.getByRole('button', { name: '复制报告链接' }).click();
  await page.getByRole('dialog', { name: '手动复制' }).waitFor();
  assert.equal(await page.getByLabel('可复制文本').inputValue(), reportUrl);
  await page.getByRole('dialog', { name: '手动复制' }).getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('heading', { name: 'GEO 分析成果报告' }).waitFor();

  await page.goBack();
  await page.getByRole('heading', { name: '填写业务资料' }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: /别让 AI/u }).waitFor();
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  results.push({ profile: 'ios_wechat', reportUrl, history: true, copyFallback: true, overflow: false, consoleErrors: 0 });
  await ios.close();

  const android = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36 MicroMessenger/8.0.50'
  });
  const androidPage = await android.newPage();
  const androidErrors = [];
  androidPage.on('console', (message) => { if (message.type() === 'error') androidErrors.push(message.text()); });
  await androidPage.goto(reportUrl, { waitUntil: 'networkidle' });
  await androidPage.getByRole('heading', { name: 'GEO 分析成果报告' }).waitFor();
  assert.equal(await hasHorizontalOverflow(androidPage), false);
  assert.equal(await androidPage.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light');
  assert.equal(androidErrors.length, 0, androidErrors.join('\n'));
  results.push({ profile: 'android_wechat', reportRecovered: true, overflow: false, consoleErrors: 0 });
  await android.close();
} finally {
  await browser.close();
  appProcess.kill('SIGTERM');
  await provider.close();
}

console.log(JSON.stringify({ ok: true, fakeProviderCalls: provider.callCount, results }, null, 2));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('port_unavailable'));
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForHealth(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {
      /* 等待服务启动 */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('app_server_start_timeout');
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}
