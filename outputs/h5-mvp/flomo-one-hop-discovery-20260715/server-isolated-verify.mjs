import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath) throw new Error('page_audit_module_path_required');

const { auditSubmittedPages } = await import(pathToFileURL(modulePath).href);
const routes = new Map([
  ['https://flomoapp.com/', `<!doctype html><html><head>
    <title>flomo 浮墨笔记</title>
    <meta name="description" content="卡片笔记与个人知识记录工具">
  </head><body>
    <main>flomo 浮墨笔记 软件 功能 产品入口</main>
    <a href="https://help.flomoapp.com/">帮助中心</a>
    <a href="https://help.flomoapp.com/privacy.html">隐私政策</a>
  </body></html>`],
  ['https://help.flomoapp.com/', '<html><head><title>flomo 101 帮助中心</title></head><body>flomo 常见问题 FAQ 功能 使用指南</body></html>'],
  ['https://help.flomoapp.com/privacy.html', '<html><head><title>flomo 隐私政策</title></head><body>flomo 隐私 个人信息 数据处理说明</body></html>']
]);
const fetchImpl = async (input) => {
  const url = String(input);
  const body = routes.get(url);
  return new Response(body ?? 'not found', {
    status: body ? 200 : 404,
    headers: { 'content-type': body ? 'text/html; charset=utf-8' : 'text/plain' }
  });
};

const audit = await auditSubmittedPages({
  businessName: 'flomo 浮墨笔记',
  description: '帮助知识工作者快速记录、回顾和检索碎片想法的卡片笔记工具',
  industry: '卡片笔记与个人知识记录工具',
  city: '全国',
  targetCustomers: '经常通过微信、手机和电脑记录灵感的知识工作者',
  links: 'https://flomoapp.com/',
  competitors: 'Notion',
  confirmedBusinessType: 'software_or_miniprogram'
}, { fetchImpl });

const privacy = audit.targets.find((target) => target.id === 'privacy');
const faq = audit.targets.find((target) => target.id === 'faq');
assert.equal(privacy?.url, 'https://help.flomoapp.com/privacy.html');
assert.equal(privacy?.status, 'ok');
assert.equal(faq?.url, 'https://help.flomoapp.com/');
assert.equal(faq?.status, 'ok');

console.log(JSON.stringify({
  ok: true,
  privacy: { url: privacy.url, status: privacy.status },
  faq: { url: faq.url, status: faq.status }
}));
