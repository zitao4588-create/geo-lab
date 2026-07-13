# AI曝光体检 H5 生产运行说明

目标域名：`https://exposure.playgamelab.cn`

## 范围

第一阶段只上线 H5 MVP：

- React/Vite 静态 H5。
- Node/Express API。
- 本地 JSON runtime 存储，包括 `diagnoses/`、`evidence/`、`submissions.jsonl` 和 `request-index/`。
- 阿里云百炼 DeepSeek `deepseek-v4-pro`、阿里千问 `qwen3.7-plus`、腾讯 TokenHub 混元 `hy3`、火山方舟豆包 `doubao-seed-2-0-lite-260215` 真实问答采样。
- 单一 `GEO 分析成果得分` 报告。
- `runtime/evidence/<reportId>/` 证据目录。
- 公开 URL 审计：homepage/privacy/features/FAQ/geo-case/robots/sitemap/llms。
- Markdown/HTML/evidence package 导出；PDF 可由 HTML 报告生成。

不包含数据库、登录、支付、Docker、后台管理、小程序或自动部署系统。

## 服务器环境变量

真实环境变量只放服务器安全位置，例如：

```text
/opt/playgamelab/ai-exposure-check-h5/.env
```

建议权限：

```bash
chmod 600 /opt/playgamelab/ai-exposure-check-h5/.env
```

示例键名：

```bash
PORT=3020
RUNTIME_DIR=/opt/playgamelab/ai-exposure-check-h5/runtime
DIAGNOSES_IP_HOURLY_LIMIT=1
DIAGNOSES_GLOBAL_DAILY_LIMIT=30
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_API_KEY=
DEEPSEEK_ENABLED=true
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FALLBACK_MODELS=deepseek-v4-flash
DEEPSEEK_SAMPLE_CONCURRENCY=5
DEEPSEEK_SAMPLE_MAX_RETRIES=1
HY3_ENABLED=true
HY3_BASE_URL=https://tokenhub.tencentmaas.com/v1
HY3_MODEL=hy3
HY3_API_KEY=
HY3_SAMPLE_CONCURRENCY=4
HY3_SAMPLE_MAX_RETRIES=1
QWEN_ENABLED=true
QWEN_MODEL=qwen3.7-plus
QWEN_SAMPLE_CONCURRENCY=4
QWEN_SAMPLE_MAX_RETRIES=1
DOUBAO_ENABLED=true
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-seed-2-0-lite-260215
DOUBAO_FALLBACK_MODELS=doubao-seed-2-0-mini-260215,doubao-seed-2-1-turbo-260628,doubao-seed-1-8-251228,doubao-seed-2-1-pro-260628
DOUBAO_API_KEY=
DOUBAO_SAMPLE_CONCURRENCY=4
DOUBAO_SAMPLE_MAX_RETRIES=1
WECHAT_JSSDK_APP_ID=
WECHAT_JSSDK_APP_SECRET=
WECHAT_JSSDK_ALLOWED_ORIGIN=https://exposure.playgamelab.cn
```

DeepSeek 生产默认并发 5，混元、千问和豆包默认并发 4；当前已启用且已配置 key 的模型在外层并行。默认问题集为每个参与模型 10 条。各模型最多重试 1 次，避免异常请求放大等待；报告叙述只由确定性规则生成，不再存在二次模型润色链路。health 不能仅凭 key 存在证明 key 当前有效；是否真实成功以 `lastRealSuccessAt` 和最近运行摘要为准。

免费额度运行规则：

- DeepSeek 和千问共用 `BAILIAN_API_KEY` / `BAILIAN_BASE_URL`；不再读取或调用 DeepSeek 官方 API key。
- 新版 `sk-ws-` Key 使用百炼 API Key 页面显示的业务空间专属 OpenAI compatible 地址。生产 Key 的自定义模型范围只勾选 `qwen3.7-plus`、`deepseek-v4-pro` 与 `deepseek-v4-flash`，并保留服务器 IP 白名单。
- `DEEPSEEK_ENABLED`、`QWEN_ENABLED`、`HY3_ENABLED`、`DOUBAO_ENABLED` 可独立停用。Hy3、Doubao 不再读取人工成本确认或截止时间变量；用户已接受真实调用可能产生的模型费用。发现异常费用、额度、授权或质量问题时，先关闭对应开关再重启服务。
- DeepSeek 默认顺序为 `deepseek-v4-pro -> deepseek-v4-flash -> 本次采样失败`。仅额度、免费层、余额、限流、授权或模型不可用等明确错误触发 Flash；超时、服务端 `5xx` 和空答案不触发跨模型重放。
- 2026-07-11 百炼控制台最近一次确认 `deepseek-v4-pro` 剩余 `999,865 / 1,000,000`、`deepseek-v4-flash` 剩余 `976,585 / 1,000,000`、`qwen3.7-plus` 剩余 `977,270 / 1,000,000`，均在 `2026-10-10` 到期并已开启“免费额度用完即停”；额度用完会返回 `403 AllocationQuota.FreeTierOnly`，不会进入百炼后付费。
- 同日从 IP 白名单内生产服务器发起的 `deepseek-v4-pro` 最小请求返回 HTTP `200`，耗时约 `1.43s`。白名单外本地请求返回 `403` 是预期安全行为，不应通过扩大白名单规避。
- 腾讯 TokenHub 当日用量页显示 `hy3` 已消耗约 `13.64K` tokens，但该页面没有给出可由 H5 读取的免费余额或“用完即停”信号。腾讯后台免费权益和费用中心仍需人工巡检。
- 现有每 IP 每小时 1 份、全局每天 30 份的产品限流继续作为免费额度保护上限，但不能替代云平台账单与余额检查。状态持久化在 `runtime/rate-limits.json`，客户端标识只保存加盐 SHA-256，不保存原始 IP；单实例重启后继续生效。

`/api/health` 分开显示 `configured`、`enabled`、`samplingAllowed` 和最近成功状态：key 存在表示 configured；独立开关表示 enabled；两者同时满足才允许采样。Hy3、Doubao 的 `costGuard=user_authorized` 只记录本轮用户已接受真实调用费用，不参与采样资格判断。

豆包免费额度运行规则：

- `DOUBAO_MODEL` 是当前主模型，`DOUBAO_FALLBACK_MODELS` 是明确错误后的备用顺序。
- 未开通、额度/余额不足、资源包耗尽或 429 限流等错误会触发备用模型；成功后当前进程优先复用该模型。
- 火山方舟新用户资源包用完后可能继续按量后付费，Chat API 和普通推理用量不能可靠区分免费包与付费量。每次发布和定期巡检应查看开通管理页的“免费推理额度”，接近耗尽时把仍有免费额度的模型移到 `DOUBAO_MODEL`。
- 2026-07-11 用户明确同意启用协作奖励计划；Doubao Seed 2.0 Lite、2.0 Mini、2.1 Turbo、1.8、2.1 Pro 及其预置推理接入点均已授权。该计划涉及模型/接入点数据采集授权。
- 奖励资源包通常次日约 11:00 发放，有效期 30 天。用户的运营目标是优先使用奖励额度、再使用初始免费额度，但实际抵扣顺序由火山引擎计费系统控制，H5 和 Chat API 无法指定或验证资源包扣减优先级。
- 每个模型的初始免费额度在 2026-07-11 控制台快照中均为 `500,000 / 500,000` tokens；这是时点数据，不是长期保证。奖励包与初始包都耗尽后应立即停用或切换仍有免费额度的模型，避免进入后付费。

前端微信号展示使用 Vite 构建期变量：

```bash
VITE_CONSULT_WECHAT_ID=
```

如果没有配置具体微信号，结果页咨询弹层仍会展示二维码，但复制按钮只复制添加说明。

微信公众号 JS-SDK 只有在账号条件满足后才启用：账号需具备分享接口权限，公众号后台需把 `exposure.playgamelab.cn` 配为 JS 接口安全域名，并在服务器 mode 600 的 `.env` 中配置 `WECHAT_JSSDK_APP_ID` 和 `WECHAT_JSSDK_APP_SECRET`。服务端只向前端返回签名参数，不返回 access token、jsapi ticket 或 AppSecret；缓存写入共享 runtime 的 `wechat-jssdk-cache.json`，权限为 mode 600。未配置、签名失败或客户端权限不足时，H5 自动保留复制链接和微信右上角分享引导，不阻断诊断与报告查看。

不要把真实 `BAILIAN_API_KEY`、`HY3_API_KEY`、`DOUBAO_API_KEY`、`WECHAT_JSSDK_APP_SECRET`、微信 access token/jsapi ticket、腾讯云 `SecretId`、`SecretKey`、服务器 IP 或 SSH 私钥写入仓库、文档、日志、前端 bundle 或输出报告。

## systemd 建议

服务名建议：

```text
ai-exposure-check-h5.service
```

运行方式：

```text
WorkingDirectory=/opt/playgamelab/ai-exposure-check-h5/current
Environment=NODE_ENV=production
EnvironmentFile=/opt/playgamelab/ai-exposure-check-h5/.env
ExecStart=/usr/bin/node dist/server/server/index.js
Restart=on-failure
```

Node 服务只监听 `127.0.0.1`，不要直接暴露公网端口。

## Caddy 建议

Caddy 站点块：

```caddy
exposure.playgamelab.cn {
	reverse_proxy 127.0.0.1:3020
}
```

修改前先读取现有 `/etc/caddy/Caddyfile` 并备份。修改后执行：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 回滚方式

优先使用 release 目录和 `current` symlink：

```text
/opt/playgamelab/ai-exposure-check-h5/releases/<timestamp>
/opt/playgamelab/ai-exposure-check-h5/current -> releases/<timestamp>
```

如果新版本失败，把 `current` 指回上一个 release，重启 systemd 服务，再执行 smoke test。不要批量删除旧 release；确认稳定后再手动清理。

## 上线后 smoke test

本地候选版本先执行：

```bash
npm run typecheck
npm test
npm run release:precheck
```

`release:precheck` 会重新构建、核对关键静态/服务端文件和 canonical，并扫描前端 bundle 中的 API key、Bearer token、私钥和云密钥赋值。需要连同本次证据目录复核时，再运行 `node scripts/scan-release-artifacts.mjs dist/client <evidence-dir>`。扫描结果只报告文件和规则名，不回显疑似密钥值。

本地或服务器执行：

```bash
curl -I https://exposure.playgamelab.cn/
curl -sS https://exposure.playgamelab.cn/api/health
curl -I https://exposure.playgamelab.cn/robots.txt
curl -I https://exposure.playgamelab.cn/sitemap.xml
curl -I https://exposure.playgamelab.cn/ai-exposure-check.html
```

只有当本次 release 修改了提交、校验、存储或报告生成行为，并且已获得用户对真实模型成本的明确授权时，才提交一个不含真实隐私、带稳定 `clientRequestId` 的受控 payload 到：

```text
POST https://exposure.playgamelab.cn/api/diagnoses
```

UI、静态页面或纯展示 release 默认跳过新诊断 POST，复用既有报告做 smoke，避免浪费模型额度。恢复可靠性 release 的受控流程是：首次请求在服务端开始生成后让客户端超时，再用完全相同 payload 和 request ID 重试；报告落盘后可再次重放同 ID；最后只替换 request ID 验证 `429`。整套流程只允许生成一份真实报告。

验收点：

- 首页返回 200。
- `/api/health` 分开返回 `configurationReady`、`samplingReady`、`configuredProviderCount` 和 `samplingAllowedProviderCount`。每个 provider 分开显示 `configured`、`samplingAllowed`、`costGuard`；`ready` 只代表配置和成本门允许，不代表最近调用成功。
- `/api/health.providers[].lastRealSuccessAt` 只来自最近一次持久化真实采样；没有运行证据时不展示。最近运行的成功率、fallback、失败类型、P50/P95 和最慢 Prompt ID 来自 `runtime/operations/latest.json`。
- `/robots.txt` 返回 `text/plain`，并指向 `https://exposure.playgamelab.cn/sitemap.xml`。
- `/sitemap.xml` 返回 `application/xml`，并列出首页、静态介绍、功能、FAQ、证据边界、隐私、协议和 `llms.txt`。
- `/ai-exposure-check.html` 返回独立静态 HTML，不应被 SPA fallback 成首页。
- `POST /api/diagnoses` 返回报告 ID，且 `aiMeta.successCount > 0`。
- 服务日志包含不带表单内容的 `diagnosis_generated` 事件，可读取 provider/模型成功率、失败类型、fallback、P50/P95、最慢 Prompt ID、`pageAuditDurationMs`、`samplingDurationMs` 和 `totalDurationMs`。日志和 operations 文件不得包含表单内容或 Prompt 全文。
- 首次成功生成返回 `201`；同 request ID 的 in-flight 或持久恢复返回 `200` 和同一报告 ID。
- 同 request ID 搭配不同表单内容返回 `409 idempotency_conflict`。
- 同一 IP 使用不同 request ID 时仍按现有限流返回 `429 rate_limited`。
- `runtime/request-index/<clientRequestId>.json` 指向本次报告，`submissions.jsonl` 只新增一行。
- `GET /api/diagnoses/:id` 可刷新查询。
- `GET /api/diagnoses/:id/evidence` 返回证据索引。
- `GET /api/diagnoses/:id/export/markdown` 返回 Markdown。
- `GET /api/diagnoses/:id/export/html` 返回 HTML。
- `GET /api/diagnoses/:id/export/evidence-package` 返回证据包 JSON。
- 前端 bundle 不包含 API key。
- 公开报告不展示联系方式。
- 公开报告和 evidence package 不展示 `clientRequestId` 或 request ID。
- 移动端和桌面端截图无明显溢出。

## 合规占位

H5 首页展示隐私政策、用户协议和备案号占位。正式公开商业化前需要单独复核：

- ICP 备案展示口径。
- 公安备案展示口径。
- 主体、收费、微信支付和小程序备案边界。
