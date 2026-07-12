import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BATCH_BASE_URL || 'http://127.0.0.1:8794';
const outputDir = path.resolve(process.cwd(), '../../outputs/h5-mvp/batch-instance-testing-20260712');
const screenshotDir = path.join(outputDir, 'screenshots');
await mkdir(screenshotDir, { recursive: true });
const cases = [
  ['physical-normal', 'diag_batch_physical_normal'],
  ['software-misread', 'diag_batch_software_misread'],
  ['local-source-boundary', 'diag_batch_local_boundary'],
  ['partial-provider-failure', 'diag_batch_partial_failure']
];
const viewports = [{ width: 390, height: 844 }, { width: 1440, height: 1000 }];
const checks = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, reportId] of cases) for (const viewport of viewports) await reportCheck(name, reportId, viewport);
  for (const viewport of viewports) await preflightCheck(viewport);
} finally {
  await browser.close();
}
await writeFile(path.join(outputDir, 'visual-qa.json'), `${JSON.stringify({ baseUrl, checks }, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'visual-qa.md'), markdown(checks), 'utf8');
console.log(JSON.stringify({ checks: checks.length, failures: checks.filter((item) => item.overflow || item.errors.length || !item.hasConfirmed || !item.hasUnverified || !item.hasConfidence || !item.hasActions || ('caseSignal' in item && !item.caseSignal)).length }, null, 2));

async function reportCheck(name, reportId, viewport) {
  const page = await browser.newPage({ viewportSize: viewport });
  const errors = capture(page);
  await page.goto(`${baseUrl}/?report=${reportId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.report-cover');
  await page.waitForTimeout(1000);
  const facts = await common(page);
  await page.screenshot({ path: path.join(screenshotDir, `${name}-${viewport.width}x${viewport.height}.png`), fullPage: true });
  checks.push({ name, reportId, viewport, ...facts, errors });
  await page.close();
}

async function preflightCheck(viewport) {
  const page = await browser.newPage({ viewportSize: viewport });
  const errors = capture(page);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '免费测一次' }).click();
  await page.getByPlaceholder('例如：冰箱小雷达').fill('证据不足测试');
  await page.getByPlaceholder('例如：帮家庭管理冰箱食材、提醒临期食品的小程序').fill('工具');
  await page.getByPlaceholder('例如：小程序工具').fill('工具');
  await page.getByPlaceholder('例如：西安 / 全国').fill('全国');
  await page.getByPlaceholder('例如：家庭主厨、上班族、小店老板').fill('所有人');
  await page.getByRole('button', { name: '生成 GEO 分析报告' }).click();
  await page.waitForSelector('.preflight-card');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const text = await page.locator('.preflight-card').innerText();
  await page.screenshot({ path: path.join(screenshotDir, `preflight-insufficient-${viewport.width}x${viewport.height}.png`), fullPage: true });
  checks.push({ name: 'preflight-insufficient', viewport, overflow, hasConfirmed: /当前资料|补充/u.test(text), hasUnverified: /官方|核验/u.test(text), hasConfidence: true, hasActions: /补充/u.test(text), errors });
  await page.close();
}

async function common(page) {
  return {
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    hasConfirmed: await page.getByText('已确认', { exact: true }).isVisible(),
    hasUnverified: await page.getByText('仍待核验', { exact: true }).isVisible(),
    hasConfidence: await page.locator('.confidence-banner').isVisible(),
    hasActions: await page.locator('.next-action-list').isVisible(),
    caseSignal: await caseSignal(page)
  };
}

async function caseSignal(page) {
  const body = await page.locator('body').innerText();
  if (body.includes('松下大锤子2.0')) return /ES-LM55/u.test(body);
  if (body.includes('冰箱小雷达')) return (await page.locator('.metric-card', { hasText: '错误认知率' }).innerText()).startsWith('100%');
  if (body.includes('海底捞西安门店服务')) return /低置信度/u.test(body) && /暂不展示总分/u.test(body);
  if (body.includes('覆盖率测试工具')) return /中等置信度/u.test(body) && /豆包.*失败 0\/1/u.test(body);
  return false;
}

function capture(page) {
  const errors = [];
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  return errors;
}

function markdown(items) {
  return `# 批次视觉验收\n\n| 状态 | 视口 | 横向溢出 | 控制台问题 | 已确认 | 待核验 | 置信度 | 下一步 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${items.map((item) => `| ${item.name} | ${item.viewport.width}×${item.viewport.height} | ${item.overflow ? '是' : '否'} | ${item.errors.length} | ${item.hasConfirmed ? '可见' : '缺失'} | ${item.hasUnverified ? '可见' : '缺失'} | ${item.hasConfidence ? '可见' : '缺失'} | ${item.hasActions ? '可见' : '缺失'} |`).join('\n')}\n`;
}
