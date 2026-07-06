# AI曝光体检 H5 UX 批次部署摘要

日期：2026-07-06
Release：`20260706165543`（替换 `20260705175108`，旧版保留可回滚）
代码提交：`da7a339`（首页减法/占位统一/去联系方式字段）+ `f783016`（转化与等待体验批次）

## 本轮内容（两批合并上线）

批次 A（da7a339）：
- 首页文字减负：删 eyebrow 胶囊、三行卖点描述、卡片内注释；副标题压缩；新增单行信任背书。
- 表单 placeholder 统一为「例如：具体示例」句式。
- 删除表单联系方式字段，联系时机后移到结果页微信 CTA；API 仍兼容可选 contact。

批次 B（f783016，对应 11 项 UX 评估）：
- 结果页：滚过封面后出现底部悬浮咨询条（到达底部 CTA 时自动隐藏）；「复制报告链接」；采样答案原文与页面审计明细默认折叠；得分数字 900ms 滚动揭晓。
- 表单：灰态提交按钮可点击，点击后 Toast + 滚动定位并高亮第一个缺失字段 + 「还差 N 项必填」实时提示。
- 429 限流：从一闪而过的 Toast 升级为页面内深色引导卡（服务端文案 + 扫码预约按钮 + 名额稀缺说明）。
- 加载页：60s/150s 分级安抚文案；GEO 小知识每 7 秒轮播；采样期间 beforeunload 离开确认。
- 表单草稿 sessionStorage 持久化，提交成功或重新分析时清除。
- 首页对话卡入场动画（气泡依次浮现 + 金色缺口脉冲），respect prefers-reduced-motion。
- 新增 SVG favicon；隐私/协议页配色与主站设计令牌对齐。
- api.ts 新增 ApiError（携带服务端错误码）。

## 线上验收结果

- `GET /` 200，新 bundle（`index-BOtoHAW8.js` / `index-BP-nHSf0.css`）与 favicon 生效。
- `GET /api/health` 200，`model=deepseek-v4-pro`，`samplingReady=true`。
- privacy / terms / favicon.svg 均 200；隐私页含新品牌色 `#2e5ce6`。
- 历史报告 `diag_mr7m81bl_mzlv8i` 200；markdown / html / evidence-package 导出均 200。
- 本轮未做新 POST 冒烟：服务端源码未变化，读路径已全量验证；节约采样配额（与 runbook 的差异点，特此记录）。
- Playwright 线上截图：移动端首页/结果页、桌面端首页均无横向溢出；结果页中段滚动时悬浮咨询条 `show` 状态确认为 true。
- 本地预览逐项验证：灰态按钮引导、草稿恢复、429 引导卡、提示轮播、折叠、count-up、悬浮条出现/隐藏。

## 产物

- `online-mobile-start.png` / `online-mobile-result.png` / `online-desktop-start.png` / `online-mobile-result-midscroll.png`

## 回滚

`ln -sfn /opt/playgamelab/ai-exposure-check-h5/releases/20260705175108 /opt/playgamelab/ai-exposure-check-h5/current && sudo systemctl restart ai-exposure-check-h5.service`
