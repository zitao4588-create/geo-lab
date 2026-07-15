# 部署验证

- 日期：2026-07-15
- 功能提交：`68aeddc`
- 生产 release：`20260715140741`
- 上一 release：`20260715023611`，保留回滚
- 生产入口：`https://exposure.playgamelab.cn`

## 发布前

- `main...origin/main`：`0/0`，无漂移。
- typecheck：通过。
- 完整测试：96/96，通过。
- release precheck：13/13，通过。
- 前端构建与本次证据目录扫描：18 个文件，0 个敏感信息发现。
- `pageAudit.js` 本地与新 release SHA-256：`0d747d3cbfbddb41a0fc4816aceda488fb508e259d8c03478c8f4e3e1e476520`，一致。

## 服务器预检与切换

- 新 release 在独立 8790 端口启动，工作目录确认指向 `releases/20260715140741`。
- 临时 health：4 configured / 4 samplingAllowed，public web active。
- 临时预检单元停止后 8790 已释放。
- `current` 原子切换到 `20260715140741`，systemd 为 active；失败回滚路径保留为 `20260715023611`。

## 不新增报告的修复验证

- `server-isolated-verify.mjs` 直接导入生产 `current/dist/server/server/pageAudit.js`。
- 仅使用内存 HTML，不访问公网、不写 runtime、不调用模型或搜索。
- 断言结果：隐私页 `https://help.flomoapp.com/privacy.html` 为 `ok`；FAQ/帮助页 `https://help.flomoapp.com/` 为 `ok`。

## 公网与浏览器

- 首页、隐私、协议、robots、sitemap、产品说明页、既有报告、evidence、Markdown、HTML 和 evidence package 共 11 个路径全部返回 200。
- health 保持 4 configured / 4 samplingAllowed；Volcengine 与 AnySearch active。
- 真实浏览器首页显示“免费测一次”、4 模型说明和合规入口。
- 既有报告 `diag_mrkv2jj7_tb6z1c` 显示最终 61 分、证据边界、导出和咨询入口；控制台 0 error / 0 warning。
- 部署前后 `latestOperation.recordedAt` 均为 `2026-07-14T20:45:48.917Z`，本轮没有新诊断运行。

## 未验证

- 没有通过生产 `POST /api/diagnoses` 对 flomo 真实公网页面生成新报告，因此真实站点基建分和建议文本未验证。
- 没有修改 SSRF、DNS、生产环境变量、限流、账号、runtime 或历史报告。
