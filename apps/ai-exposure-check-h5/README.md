# AI曝光体检 H5

第一阶段 H5 产品：无登录、无支付、无数据库，用于收集业务信息并生成带 DeepSeek、Hy3、Qwen 真实 API 采样证据、公开 URL 审计和导出包的 GEO 分析成果报告。

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
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_SAMPLE_CONCURRENCY=5
DEEPSEEK_SAMPLE_MAX_RETRIES=1
DEEPSEEK_POLISH_ENABLED=false
HY3_API_KEY=...
HY3_BASE_URL=https://tokenhub.tencentmaas.com/v1
HY3_MODEL=hy3
HY3_SAMPLE_CONCURRENCY=4
HY3_SAMPLE_MAX_RETRIES=1
QWEN_API_KEY=...
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3.7-plus
QWEN_SAMPLE_CONCURRENCY=4
QWEN_SAMPLE_MAX_RETRIES=1
VITE_CONSULT_WECHAT_ID=
```

DeepSeek、Hy3、Qwen 至少配置一个 API Key 才能生成报告；全部未配置时，后端返回 `503 sampling_unavailable`，不再用规则模板冒充最终报告。
每个已配置平台默认执行同一组 10 条核心采样，平台之间并行，平台内部按各自 `*_SAMPLE_CONCURRENCY` 限流。三个生产平台合计 30 次调用；页面审计也与采样并行执行。总调用量会随已配置平台数线性增加。
采样请求默认最多重试 1 次，可通过各 provider 的 `*_SAMPLE_MAX_RETRIES` 在 0-2 之间调整，避免 SDK 默认 2 次重试放大异常等待。
`DEEPSEEK_POLISH_ENABLED` 默认关闭，避免在评分和证据已经生成后再等待一次只改建议文案的模型请求；设为 `true` 可恢复该可选润色。
没有 `VITE_CONSULT_WECHAT_ID` 时，结果页仍展示二维码，复制按钮只复制添加说明。

## API

- `POST /api/diagnoses`：生成最终 GEO 分析报告。
- `GET /api/diagnoses/:id`：按报告 ID 查询。
- `GET /api/diagnoses/:id/evidence`：读取证据索引。
- `GET /api/diagnoses/:id/export/markdown`：导出 Markdown 报告。
- `GET /api/diagnoses/:id/export/html`：导出 HTML 报告。
- `GET /api/diagnoses/:id/export/evidence-package`：导出证据包 JSON。

当前真实采样 adapter 包括 DeepSeek 官方 API、腾讯 TokenHub Hy3 和阿里云百炼 Qwen。豆包、Kimi、元宝、通义消费端、文心等仍只登记状态，未配置时明确返回 `unavailable`，不生成模拟结果。API 响应不等于对应消费端产品的搜索结果。

## Production Notes

第一阶段线上入口使用 `https://exposure.playgamelab.cn`，同一个 Node/Express 服务提供静态 H5 和 API。2026-07-06 release `20260706165543` 已上线 UX 批次：首页文案减负、表单占位统一并移除联系方式字段、结果页悬浮咨询条与证据折叠、429 引导卡、加载分级文案与草稿保存、favicon 与合规页配色对齐。

上一轮 2026-07-05 release `20260705175108` 完成 UI 全面焕新：深色首页叙事 + AI 对话演示、报告封面得分卡、表单分组和咨询弹层修复，合规文案保持不变。

上一轮 2026-07-03 release `20260703201836` 上线了 optional contact、微信二维码咨询弹层、严格限流、合规文案和首屏转化优化。

上一轮 2026-06-30 release `202606300728` 已完成上线后 URL 审计、报告导出和 `冰箱小雷达` before/after 复测。

部署、Caddy、systemd、回滚和 smoke test 清单见 `docs/production-runbook.md`。真实 `.env` 只放服务器安全路径，不进入仓库、前端 bundle 或报告文件。
