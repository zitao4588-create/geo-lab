import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CREDIBILITY_BASE_URL || 'http://127.0.0.1:8793';
const visualCase = process.env.VISUAL_CASE || 'all';
const outputDir = path.resolve(process.cwd(), '../../outputs/h5-mvp/report-credibility-hardening-20260712');
const screenshotDir = path.join(outputDir, 'screenshots');
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const checks = [];

try {
  if (visualCase === 'all' || visualCase === 'reports') {
    await checkReport('fridge', 'diag_credibility_fridge', { width: 390, height: 844 });
    await checkReport('panasonic', 'diag_credibility_panasonic', { width: 1440, height: 1000 });
  }
  if (visualCase === 'all' || visualCase === 'preflight') await checkPreflight();
} finally {
  await browser.close();
}

const visualQaPath = path.join(outputDir, 'visual-qa.json');
const previousChecks = await readPreviousChecks(visualQaPath);
const combinedChecks = [...previousChecks.filter((item) => !checks.some((current) => current.name === item.name)), ...checks];
await writeFile(visualQaPath, `${JSON.stringify({ baseUrl, checks: combinedChecks }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(checks, null, 2));

async function checkReport(name, reportId, viewport) {
  const page = await browser.newPage({ viewportSize: viewport });
  const errors = captureErrors(page);
  await page.goto(`${baseUrl}/?report=${reportId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.report-cover');
  await page.waitForTimeout(1000);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const hasCredibility = await page.getByText('这份报告能确认什么').isVisible();
  const hasMetrics = await page.getByText('正确实体识别').first().isVisible();
  const hasConflict = await page.locator('.conflict-card').count() > 0;
  await page.screenshot({ path: path.join(screenshotDir, `${name}-${viewport.width}-full.png`), fullPage: true });
  checks.push({ name: `${name}-${viewport.width}`, overflow, hasCredibility, hasMetrics, hasConflict, errors });
  await page.close();
}

async function checkPreflight() {
  const page = await browser.newPage({ viewportSize: { width: 390, height: 844 } });
  page.setDefaultTimeout(5_000);
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '免费测一次' }).click();
  await page.getByPlaceholder('例如：冰箱小雷达').fill('松下大锤子剃须刀');
  await page.getByPlaceholder('例如：帮家庭管理冰箱食材、提醒临期食品的小程序').fill('电动剃须刀');
  await page.locator('.business-type-tags button').first().click();
  await page.getByPlaceholder('例如：小程序工具').fill('男士清洁工具');
  await page.getByPlaceholder('例如：西安 / 全国').fill('全国');
  await page.getByPlaceholder('例如：家庭主厨、上班族、小店老板').fill('成年男性');
  await page.getByRole('button', { name: '生成 GEO 分析报告' }).click();
  await page.waitForSelector('.preflight-card');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const cardText = await page.locator('.preflight-card').innerText();
  const response = await page.request.post(`${baseUrl}/api/diagnoses/preflight`, {
    data: {
      businessName: '松下大锤子剃须刀',
      description: '电动剃须刀',
      links: '',
      industry: '男士清洁工具',
      city: '全国',
      targetCustomers: '成年男性',
      competitors: '',
      confirmedBusinessType: 'physical_product'
    }
  });
  const assessment = await response.json();
  await page.locator('.preflight-card').scrollIntoViewIfNeeded();
  await page.locator('.preflight-card').screenshot({ path: path.join(screenshotDir, 'preflight-card.png') });
  await page.screenshot({ path: path.join(screenshotDir, 'preflight-mobile-390x844.png'), fullPage: true });
  checks.push({ name: 'preflight-mobile-390', overflow, cardText, assessment, errors });
  await page.close();
}

function captureErrors(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`console:${message.type()}:${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  return errors;
}

async function readPreviousChecks(file) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(value.checks) ? value.checks : [];
  } catch {
    return [];
  }
}
