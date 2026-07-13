# H5 火山 + AnySearch 联网候选发现发布记录

日期：2026-07-14（Asia/Shanghai）

生产地址：`https://exposure.playgamelab.cn`

新 release：`20260714004607`

上一 release：`20260713132053`（保留，可回滚）

## 本次上线范围

- H5 的四模型采样与火山联网、AnySearch 联网候选发现并行执行。
- 搜索结果合并、按 URL 去重，并保留来源 provider。
- 报告增加“公开证据可发现度”，总分对外改称“初步诊断分”。
- 页面明确声明 API 采样不等于消费端实时搜索或稳定排名。
- 完整报告咨询入口明确指向消费端新会话、搜索/引用、截图与人工核验。

正式客户报告的 Codex 工作流仅保留在仓库，本次未作为线上 H5 功能部署；`sources/` 未修改。

## 生产配置边界

- `PUBLIC_WEB_GROUNDING_ENABLED=true`
- `PUBLIC_WEB_GROUNDING_PROVIDERS=volcengine,anysearch`
- `VOLCENGINE_SEARCH_ENABLED=true`
- `ANYSEARCH_SEARCH_ENABLED=true`
- `ANYSEARCH_ALLOW_ANONYMOUS=true`
- `DIAGNOSIS_SLA_MS=30000`
- `DIAGNOSIS_REPORT_RESERVE_MS=2500`
- `WEB_SEARCH_TIMEOUT_MS=30000`
- 每 IP 每小时 1 份、全局每天 30 份的既有限流保持不变。
- 生产密钥未进入 release、前端 bundle 或本记录；服务器 `.env` 仍为 mode `600`。

## 验收证据

- 本地 `npm run release:precheck`：通过；15 个前端文件扫描，0 个密钥规则命中。
- 新 release 临时端口启动：通过。
- AnySearch 匿名连通性请求：HTTP `200`，未携带用户数据。
- `/api/health`：四个模型 provider 均 configured/samplingAllowed；火山与 AnySearch 均 active。
- 首页、features、FAQ、privacy、terms、robots、sitemap、llms、独立介绍页：均返回 `200`，内容类型符合预期。
- 既有报告查询、evidence、Markdown、HTML、evidence package：均返回 `200`。
- 新前端 bundle 包含“AI 可见度初步诊断报告”和消费端边界文案。
- systemd：`ai-exposure-check-h5.service` 为 `active`；发布后日志只有正常停止、启动和监听记录。
- 本地与线上 release 的服务端入口、前端入口和主 JS bundle SHA-256 完全一致。

## 本轮明确未执行

- 未提交新的生产 `POST /api/diagnoses`。
- 未新增生产报告、未写入新的真实表单数据。
- 未为部署验收额外调用 DeepSeek、Qwen、Hy3、Doubao。
- 未执行火山联网的额外付费 canary；其生产配置沿用已开通的豆包凭据，真实成功仍需下一份自然用户报告或另行授权的一次受控诊断确认。
- 未 commit、未 push、未打 tag。

## 完成等级与风险

完成等级：`C3`（已部署并完成只读公网验收）。

尚不能称为 `C4`：本次没有生成一份同时包含四模型、火山和 AnySearch 的生产报告，因此 30 秒内完成整单、两路搜索真实成功和合并评分仍待首份自然用户结果验证。AnySearch 匿名接口当前可用，但公开商业使用条款与长期免费稳定性仍未被本轮技术验收确认；出现授权、额度、费用或稳定性异常时，应独立关闭对应搜索开关。

## 回滚

```bash
cp /opt/playgamelab/ai-exposure-check-h5/.env.before-20260714004607 /opt/playgamelab/ai-exposure-check-h5/.env
ln -sfn /opt/playgamelab/ai-exposure-check-h5/releases/20260713132053 /opt/playgamelab/ai-exposure-check-h5/current
sudo systemctl restart ai-exposure-check-h5.service
```
