# AI曝光体检 H5

第一阶段 H5 产品：无登录、无支付、无数据库，用于收集业务信息并生成带真实 DeepSeek 采样证据、公开 URL 审计和导出包的 GEO 分析成果报告。

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
VITE_CONSULT_WECHAT_ID=
```

没有 `DEEPSEEK_API_KEY` 时，后端会返回 `503 sampling_unavailable`，不再用规则模板冒充最终报告。
没有 `VITE_CONSULT_WECHAT_ID` 时，结果页仍展示二维码，复制按钮只复制添加说明。

## API

- `POST /api/diagnoses`：生成最终 GEO 分析报告。
- `GET /api/diagnoses/:id`：按报告 ID 查询。
- `GET /api/diagnoses/:id/evidence`：读取证据索引。
- `GET /api/diagnoses/:id/export/markdown`：导出 Markdown 报告。
- `GET /api/diagnoses/:id/export/html`：导出 HTML 报告。
- `GET /api/diagnoses/:id/export/evidence-package`：导出证据包 JSON。

当前真实采样平台只有 DeepSeek。豆包、Kimi、元宝、通义、文心等平台只登记 adapter 状态，未配置时明确返回 `unavailable`，不生成模拟结果。

## Production Notes

第一阶段线上入口使用 `https://exposure.playgamelab.cn`，同一个 Node/Express 服务提供静态 H5 和 API。2026-07-03 release `20260703201836` 已上线 optional contact、微信二维码咨询弹层、严格限流、合规文案和首屏转化优化。

上一轮 2026-06-30 release `202606300728` 已完成上线后 URL 审计、报告导出和 `冰箱小雷达` before/after 复测。

部署、Caddy、systemd、回滚和 smoke test 清单见 `docs/production-runbook.md`。真实 `.env` 只放服务器安全路径，不进入仓库、前端 bundle 或报告文件。
