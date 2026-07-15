# 前后验证

## 修复前

新增 flomo 回归后执行：

`npm run build:server && node --test test/page-audit-source-binding.test.mjs`

- 结果：7 个用例中 6 个通过、1 个失败。
- 失败证据：隐私目标实际为 `https://flomoapp.com/privacy.html`，期望为首页链接的 `https://help.flomoapp.com/privacy.html`。
- 结论：假阴性由固定路径策略直接造成。

共享托管域回归加入后，现实现错误接受 `https://tenant-b.github.io/privacy.html` 作为 `tenant-a.github.io` 的官方页面，证明简单比较最后两段域名会扩大证据边界。

## 修复后

- `npm run typecheck`：通过。
- 定向 PageAudit：8/8 通过。
- 完整测试：96/96 通过，0 失败。
- 完整集成测试在沙箱内首次因 `listen EPERM 127.0.0.1` 失败；在允许本机回环的同一命令下重跑为 96/96，通过。该失败不是代码断言失败。

## 已覆盖边界

1. `flomoapp.com` 可发现 `help.flomoapp.com/` 和 `help.flomoapp.com/privacy.html`。
2. `privacy.example.net` 不会进入官方审计。
3. `help.flomoapp.com.evil.example` 不会通过后缀伪装。
4. `tenant-a.github.io` 不会接受 `tenant-b.github.io` 的页面。
5. 首页没有合格一跳链接时仍使用原 `/privacy.html`、`/faq/` fallback。
6. 一跳页面重定向出提交站点边界时降级为建议补充，不标为 `verified_external`。
