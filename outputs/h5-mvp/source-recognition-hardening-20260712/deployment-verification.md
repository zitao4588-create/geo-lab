# 部署验证

状态：通过。

- 分支：`codex/source-recognition-hardening`
- 功能与证据提交：`5c798b3 feat: harden H5 source credibility`
- 远端：已核验为用户账号下的 GitHub 私有仓库并完成推送。
- 生产 release：`20260712095412`
- 上一 release：`20260711141454`，保留用于回滚。
- `current`：已指向新 release。
- systemd：`ai-exposure-check-h5.service` 为 `active`。

预切换检查：

- 新 release 在临时端口 `8790` 启动成功。
- `samplingReady=true`，`configuredProviderCount=4`。
- DeepSeek、Hy3、Qwen、Doubao 均为 `ready`。
- 默认模型 `deepseek-v4-pro`，并发 `5`，重试 `1`，润色关闭。

公网 smoke：

- 首页、`/api/health`、`robots.txt`、`sitemap.xml`、独立介绍页均返回 `200`。
- 既有报告的查询、证据索引、Markdown、HTML、evidence package 均返回 `200`。
- 前端 bundle 密钥模式扫描通过。
- 未提交新的生产诊断 POST：本次 Goal 明确排除生产数据修改，因此没有新增 runtime 报告，也没有额外消耗四模型额度。
