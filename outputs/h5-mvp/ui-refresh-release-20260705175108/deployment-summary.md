# AI曝光体检 H5 UI 焕新部署摘要

日期：2026-07-05
Release：`20260705175108`（替换 `20260703201836`）
代码提交：`dc6b59d Redesign H5 UI for premium feel and conversion`

## 本轮内容

- H5 四屏 UI/UX 全面重设计：深蓝墨色 + 单一品牌蓝 + 琥珀金点缀的设计系统。
- 首页改为深色叙事：AI 对话演示卡（竞品 A/B + 金色虚线「你的品牌？」缺口）替换原卡通插画；删除不可点击的假 tab。
- 结果页得分卡改为深色报告封面，评分环颜色随风险等级变化；未配置平台从 5 个胶囊降噪为一行说明。
- 表单分组为「基础信息（必填）/ 补充信息（选填）」；输入框聚焦态、行业快捷标签重做。
- 加载页假进度只推进到第 4 步，最后一项保持进行中，直到真实结果返回。
- 修复咨询弹层被 `.screen` 入场动画残留 transform 劫持导致跑出视口的 bug。
- 保留全部合规文案：备案号、隐私政策、用户协议、「备案展示以 exposure 子域名最终核验为准」、证据边界与「不生成模拟结果」表述。

## 部署方式

- 本地 `npm run typecheck` + `npm run build` 通过后，rsync `dist/docs/public/package*.json` 到 `releases/20260705175108/`。
- 服务器 `npm ci --omit=dev`（Node v22.23.0）。
- 切换 `current` symlink 前，先在 `PORT=8790` 做预检（health 200、homepage 200），再切换并 `systemctl restart`。
- `RUNTIME_DIR` 为共享绝对路径，历史报告 ID 在新 release 下继续可访问（已验证 `diag_mr4wim6t_gfcg0g` 返回 200）。

## 线上验收结果

- `GET /` HTTP 200，页面标题与 bundle hash（`index-BlSd6_Tl.css` / `index-towYLq7n.js`）与本次构建一致。
- `GET /api/health` HTTP 200，`model=deepseek-v4-pro`，`samplingReady=true`。
- `GET /privacy.html`、`GET /terms.html` HTTP 200。
- `POST /api/diagnoses`（无联系方式测试 payload）服务端生成成功；客户端 curl 3 分钟超时属采样耗时波动，报告已落盘。
- 线上 smoke 报告 ID：`diag_mr7m81bl_mzlv8i`，得分 42/100（待提升），`aiMeta.successCount=20/20`。
- `GET /api/diagnoses/:id`、`/evidence`、`/export/markdown|html|evidence-package` 全部 HTTP 200。
- 前端 bundle 无 `DEEPSEEK_API_KEY`、无 `sk-` 形态密钥（`sk-` 命中仅为 TDesign 骨架屏类名）。
- 公开报告不含联系方式（测试 payload 未提交 contact）。
- Playwright 线上截图：移动端（375×812）与桌面端（1440×900）首页、结果页均无横向溢出。
- 限流复验（补测）：窗口内重复 `POST /api/diagnoses` 返回 `429 rate_limited`。说明：首次复测隔了约 2 小时 45 分，超出 1 小时 IP 窗口，返回 `201` 属正确行为，但因此多生成了一份测试报告 `diag_mr7saxjg_8u68br`（垃圾数据，可忽略）；随后在窗口内立即重发，确认 `429` 生效。

## 产物

- `input.json`（POST 客户端 curl 超时中断，无 post-response 文件；报告以 `get-report.json` 为准）
- `get-report.json` / `evidence-index.json` / `evidence-package.json`
- `export.md` / `export.html`
- `online-mobile-start.png` / `online-mobile-result.png`
- `online-desktop-start.png` / `online-desktop-result.png`

## 回滚方式

`ln -sfn /opt/playgamelab/ai-exposure-check-h5/releases/20260703201836 /opt/playgamelab/ai-exposure-check-h5/current && sudo systemctl restart ai-exposure-check-h5.service`

## 安全边界

- 未把 DeepSeek key、服务器 IP、SSH 私钥写入仓库、前端 bundle 或输出报告。
- 测试 payload 不含真实商家与真实个人信息。
