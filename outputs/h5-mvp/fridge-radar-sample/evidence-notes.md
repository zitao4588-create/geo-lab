# 冰箱小雷达样例报告证据说明

## 输入来源

- `raw_source`：`/Users/qzt/Developer/projects/fridge-app/geo/brand-brief.yaml`
- `raw_source`：`/Users/qzt/Developer/projects/fridge-app/geo/prompt-universe.csv`
- `raw_source`：`/Users/qzt/Developer/geo-lab/sources/local-artifacts/fridge-radar/冰箱小雷达冰箱食材库存管理小程序-diag-report.json`
- `raw_source`：`/Users/qzt/Developer/geo-lab/cases/fridge-radar/README.md`
- `raw_source`：`/Users/qzt/Developer/projects/fridge-app/README.md`
- `raw_source`：`/Users/qzt/Developer/projects/fridge-app/PROJECT_CONTEXT.md`

## 本轮验证

- `verified_external`：本地 H5 服务 `http://127.0.0.1:8787/api/health` 返回 `model=deepseek-v4-pro`。
- `verified_external`：本地 `POST /api/diagnoses` 返回 HTTP `201`。
- `verified_external`：API 响应报告 ID 为 `diag_mqzq5tep_rylpbo`。
- `verified_external`：API 响应中 `aiMeta.provider=deepseek`，`aiMeta.status=used`。
- `verified_external`：公开联系方式未出现在 `api-response.json` 的报告对象中。
- `verified_external`：线上 `https://exposure.playgamelab.cn/` 返回 HTTP `200`。
- `verified_external`：线上 `https://exposure.playgamelab.cn/api/health` 返回 HTTP `200` 且 `model=deepseek-v4-pro`。
- `verified_external`：线上 `POST /api/diagnoses` 返回 HTTP `201`，线上 smoke 报告 ID 为 `diag_mqzqeaod_ez3318`。
- `verified_external`：线上 `GET /api/diagnoses/diag_mqzqeaod_ez3318` 返回 HTTP `200`。

## 截图证据

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

## 模型和规则边界

- `model_inference`：报告摘要、主要问题和行动路线由 H5 规则报告结合 DeepSeek `deepseek-v4-pro` 改写生成。
- `suggested_supplement`：真实用户反馈、使用案例和进一步 FAQ 需要后续补充证据。
- `suggested_supplement`：本轮没有采样 DeepSeek、Kimi、豆包、元宝等 AI 搜索答案，不能证明实际推荐排名或引用变化。

## 不可对外声称

- 不声称冰箱小雷达已经被 AI 平台稳定推荐。
- 不声称真实曝光、引用率、排名、留存率、用户规模或收入提升。
- 不把旧 GEO 报告中的虚拟/模拟来源当成真实媒体或真实搜索结果。
- 不公开 `input.json` 中的内部占位联系方式。

## 生成产物

- `input.json`：H5 表单输入，含内部 contact 占位，仅用于本地复现。
- `api-response.json`：本地 API 原始响应。
- `online-smoke.json`：线上 HTTPS API smoke test 摘要，不包含联系方式。
- `sample-report.md`：可评审报告正文，不包含联系方式。
- `screenshots/`：H5 页面截图。
