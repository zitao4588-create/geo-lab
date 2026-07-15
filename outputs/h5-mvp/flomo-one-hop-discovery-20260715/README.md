# flomo 一跳官方页面发现最小验证

- 日期：2026-07-15
- 范围：仅修改 H5 `PageAudit` 的隐私/帮助 FAQ 一跳发现；已完成维护发布，但不创建新的生产报告。
- 根因：原实现只在提交 URL 主机上硬拼 `/privacy.html` 与 `/faq/`，没有读取首页真实链接，因此无法从 `flomoapp.com` 发现 `help.flomoapp.com`。
- 修复：先审计用户提交页并提取一跳 `<a href>`；提交根域或 `www` 根域可接受其子域，提交本身为子域时只接受自身及更深子域；无合格链接时保留固定路径 fallback。
- 防护：拒绝无关跨域、域名后缀伪装和共享托管平台的兄弟租户；动态页面跳转出提交站点边界时不标为已核验。
- 性能：提交页与一跳页面共享原有页面审计超时预算，不额外侵占模型采样 SLA。

## 结论

代码级与隔离 flomo 回归通过；修复已随 release `20260715140741` 部署，服务器当前 release 上的无网络隔离断言也通过。当前机器的本地 Node 实网抓取因 DNS 被解析为保留地址而被 SSRF 防护正确拒绝，因此没有创建第 4 份生产报告来复测 flomo 的真实站点分数。没有为完成测试关闭 SSRF 或加入白名单。

## 证据

- `before-after.md`
- `live-boundary.md`
- `deployment-verification.md`
- `server-isolated-verify.mjs`
- 代码：`apps/ai-exposure-check-h5/src/server/pageAudit.ts`
- 回归：`apps/ai-exposure-check-h5/test/page-audit-source-binding.test.mjs`
