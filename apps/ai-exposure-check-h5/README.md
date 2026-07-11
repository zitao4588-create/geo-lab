# AI曝光体检 H5

第一阶段 H5 产品：无登录、无支付、无数据库。免费版通过阿里云百炼、腾讯 TokenHub、火山方舟调用 DeepSeek、千问、混元、豆包四个模型，生成带真实 API 采样证据、公开 URL 审计和导出包的 GEO 分析成果报告。

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run start
```

## Environment

复制 `.env.example` 到 `.env.local` 或 `.env` 后配置：

```bash
PORT=8787
RUNTIME_DIR=runtime
DIAGNOSES_IP_HOURLY_LIMIT=1
DIAGNOSES_GLOBAL_DAILY_LIMIT=30
BAILIAN_API_KEY=...
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DEEPSEEK_ENABLED=true
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FALLBACK_MODELS=deepseek-v4-flash
DEEPSEEK_SAMPLE_CONCURRENCY=5
DEEPSEEK_SAMPLE_MAX_RETRIES=1
DEEPSEEK_POLISH_ENABLED=false
HY3_ENABLED=true
HY3_API_KEY=...
HY3_BASE_URL=https://tokenhub.tencentmaas.com/v1
HY3_MODEL=hy3
HY3_SAMPLE_CONCURRENCY=4
HY3_SAMPLE_MAX_RETRIES=1
QWEN_ENABLED=true
QWEN_MODEL=qwen3.7-plus
QWEN_SAMPLE_CONCURRENCY=4
QWEN_SAMPLE_MAX_RETRIES=1
DOUBAO_ENABLED=true
DOUBAO_API_KEY=...
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-seed-2-0-lite-260215
DOUBAO_FALLBACK_MODELS=doubao-seed-2-0-mini-260215,doubao-seed-2-1-turbo-260628,doubao-seed-1-8-251228,doubao-seed-2-1-pro-260628
DOUBAO_SAMPLE_CONCURRENCY=4
DOUBAO_SAMPLE_MAX_RETRIES=1
VITE_CONSULT_WECHAT_ID=
```

百炼、TokenHub、方舟至少配置一个 API Key 才能生成报告；全部未配置时，后端返回 `503 sampling_unavailable`，不再用规则模板冒充最终报告。`BAILIAN_API_KEY` 同时供 DeepSeek 和千问使用，原 DeepSeek 官方 API key 不再参与采样。
新版 `sk-ws-` 百炼 Key 应使用 API Key 页面显示的业务空间专属 OpenAI compatible 地址，并在自定义权限中勾选 `qwen3.7-plus`、`deepseek-v4-pro` 和 `deepseek-v4-flash`。生产 Key 继续使用服务器 IP 白名单，不要为本地调试放宽为全网可访问。
每个启用模型默认执行同一组 10 条核心采样，四个模型外层并行，模型内部按各自 `*_SAMPLE_CONCURRENCY` 限流，合计 40 次调用；页面审计也与采样并行执行。
采样请求默认最多重试 1 次，可通过各 provider 的 `*_SAMPLE_MAX_RETRIES` 在 0-2 之间调整，避免 SDK 默认 2 次重试放大异常等待。
`DEEPSEEK_POLISH_ENABLED` 默认关闭，避免在评分和证据已经生成后再等待一次只改建议文案的模型请求；设为 `true` 可恢复该可选润色。
`DEEPSEEK_ENABLED`、`QWEN_ENABLED`、`HY3_ENABLED`、`DOUBAO_ENABLED` 可单独停用模型。免费额度耗尽时应优先关闭对应开关，不应切入付费模型。
DeepSeek 默认按 `deepseek-v4-pro -> deepseek-v4-flash -> 本次采样失败` 运行。只有额度、免费层、余额、限流、授权或模型不可用等明确错误会切到 Flash；超时、服务端 `5xx` 和空答案不会触发跨模型重放。
2026-07-11 百炼控制台最近一次确认：`deepseek-v4-pro` 剩余 `999,865 / 1,000,000`、`deepseek-v4-flash` 剩余 `976,585 / 1,000,000`、`qwen3.7-plus` 剩余 `977,270 / 1,000,000`，三者均在 `2026-10-10` 到期且已开启“免费额度用完即停”。额度是时点数据，后台状态才是权威值。
同日从 IP 白名单内的生产服务器完成一次 `deepseek-v4-pro` 最小真实请求，返回 HTTP `200`、耗时约 `1.43s`；这只验证 API 链路，不代表完整 40 次采样报告的端到端耗时。
豆包会在当前模型返回未开通、额度/余额不足或限流等明确错误时，按 `DOUBAO_FALLBACK_MODELS` 顺序切换，并在当前服务进程内优先复用成功模型。免费资源包用尽后可能自动转按量后付费，Chat API 不提供可靠的“免费额度剩余”信号；必须以火山方舟开通管理页为准，接近耗尽时主动调整 `DOUBAO_MODEL`。
2026-07-11 经用户明确同意，五个豆包模型族及其预置推理接入点已加入协作奖励计划。奖励资源包通常次日约 11:00 发放、有效期 30 天；资源包实际抵扣优先级由火山引擎计费系统决定，应用代码不能保证“奖励额度先于初始额度”扣减。
没有 `VITE_CONSULT_WECHAT_ID` 时，结果页仍展示二维码，复制按钮只复制添加说明。

## API

- `POST /api/diagnoses`：生成最终 GEO 分析报告。
- `GET /api/diagnoses/:id`：按报告 ID 查询。
- `GET /api/diagnoses/:id/evidence`：读取证据索引。
- `GET /api/diagnoses/:id/export/markdown`：导出 Markdown 报告。
- `GET /api/diagnoses/:id/export/html`：导出 HTML 报告。
- `GET /api/diagnoses/:id/export/evidence-package`：导出证据包 JSON。

当前免费版 adapter 包括阿里云百炼 DeepSeek、阿里千问、腾讯 TokenHub 混元和火山方舟豆包。报告只展示这四个模型的真实 API 返回；API 响应不等于对应消费端产品的搜索结果或全网排名。

## Production Notes

第一阶段线上入口使用 `https://exposure.playgamelab.cn`，同一个 Node/Express 服务提供静态 H5 和 API。2026-07-06 release `20260706165543` 已上线 UX 批次：首页文案减负、表单占位统一并移除联系方式字段、结果页悬浮咨询条与证据折叠、429 引导卡、加载分级文案与草稿保存、favicon 与合规页配色对齐。

上一轮 2026-07-05 release `20260705175108` 完成 UI 全面焕新：深色首页叙事 + AI 对话演示、报告封面得分卡、表单分组和咨询弹层修复，合规文案保持不变。

上一轮 2026-07-03 release `20260703201836` 上线了 optional contact、微信二维码咨询弹层、严格限流、合规文案和首屏转化优化。

上一轮 2026-06-30 release `202606300728` 已完成上线后 URL 审计、报告导出和 `冰箱小雷达` before/after 复测。

部署、Caddy、systemd、回滚和 smoke test 清单见 `docs/production-runbook.md`。真实 `.env` 只放服务器安全路径，不进入仓库、前端 bundle 或报告文件。
