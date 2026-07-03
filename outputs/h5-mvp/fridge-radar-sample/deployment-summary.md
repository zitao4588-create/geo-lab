# AI曝光体检 H5 MVP 部署摘要

日期：2026-06-30

## 线上入口

- H5：`https://exposure.playgamelab.cn/`
- Health：`https://exposure.playgamelab.cn/api/health`
- 样例本地报告 ID：`diag_mqzq5tep_rylpbo`
- 线上 smoke 报告 ID：`diag_mqzqeaod_ez3318`

## 本轮完成

- 用冰箱小雷达生成 1 份 DeepSeek-enabled H5 初筛样例报告。
- 打磨 H5 结果页证据边界、报告 ID、模型状态、判断依据、建议卡片和 CTA。
- 增加隐私政策、用户协议和备案号占位入口。
- 增加生产运行说明：systemd、Caddy、env、回滚、smoke test。
- 创建 `exposure.playgamelab.cn` DNSPod A 记录。
- 部署 Node/Express H5 服务到轻量服务器。
- 配置 Caddy HTTPS 反向代理。
- 完成本地和线上 smoke test。

## 验证结果

- `npm run typecheck`：通过。
- `npm run build`：通过。
- 本地 `/api/health`：HTTP 200，`model=deepseek-v4-pro`。
- 本地 `POST /api/diagnoses`：HTTP 201。
- 本地 `GET /api/diagnoses/:id`：HTTP 200。
- 无 key fallback：`provider=rules`，`status=skipped`。
- 模型异常 fallback：`provider=rules`，`status=fallback`。
- DNSPod：`exposure` A 记录已启用。
- 公共 DNS：`exposure.playgamelab.cn` 可解析。
- systemd：`ai-exposure-check-h5.service` 为 active/enabled。
- Caddy：validate 通过，reload 后 active。
- 线上 `/`：HTTP 200。
- 线上 `/api/health`：HTTP 200，`model=deepseek-v4-pro`。
- 线上 `/privacy.html`：HTTP 200。
- 线上 `/terms.html`：HTTP 200。
- 线上 `POST /api/diagnoses`：HTTP 201。
- 线上 `GET /api/diagnoses/:id`：HTTP 200。

## 产物

- `input.json`
- `api-response.json`
- `sample-report.md`
- `evidence-notes.md`
- `online-smoke.json`
- `screenshots/mobile-start.png`
- `screenshots/mobile-form.png`
- `screenshots/mobile-loading.png`
- `screenshots/mobile-result.png`
- `screenshots/desktop-result.png`
- `screenshots/online-mobile-start.png`
- `screenshots/online-mobile-form.png`
- `screenshots/online-mobile-loading.png`
- `screenshots/online-mobile-result.png`
- `screenshots/online-desktop-result.png`

## 安全边界

- 未把 DeepSeek key 写入前端 bundle、公开报告或文档。
- 未把腾讯云 SecretId/SecretKey 写入项目文档。
- 未把服务器公网 IP 写入项目文档。
- 公开报告正文不包含联系方式。
- `input.json` 包含内部 contact 占位，仅用于本地复现，不作为公开报告。

## 剩余风险

- `exposure.playgamelab.cn` 当前适合作为技术内测入口。
- 公开商业化前需要复核 ICP 备案展示、公安备案展示、主体、收费和正式隐私政策文本。
- 当前报告是 H5 初筛，不做真实 AI 平台采样，不证明 AI 排名、引用率或曝光提升。
