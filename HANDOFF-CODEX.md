# Codex 交接文档

交接日期：2026-07-10
交接人：Codex（本轮完成报告提交恢复可靠性、生产部署与真实受控验收）
阅读顺序建议：本文档 → `AGENTS.md` → `PROJECT_CONTEXT.md` → `TODO.md` → 按任务读源码

---

## 1. 项目一句话

「AI曝光体检」：免费 H5 工具，用户填 30 秒业务资料，系统拿 20 个真实问题调 DeepSeek 官方 API 采样，生成带原始答案证据的 GEO 分析报告；转化目标是报告交付后加微信咨询，人工完整体检/GEO 优化服务的范围、报价、交易与交付确认在 H5 外完成。

- 线上入口：`https://exposure.playgamelab.cn`
- 代码位置：`apps/ai-exposure-check-h5/`（React+Vite+TDesign Mobile / Node+Express，无数据库/登录/支付）
- 第一阶段红线：不引入数据库、登录、支付、Docker、队列（见 `AGENTS.md`）

## 2. 当前线上状态（截至 2026-07-10）

- **线上 release：`20260710114018`（报告提交与恢复可靠性批次）**，上一版 `20260708163730` 保留在服务器可回滚。
- 服务健康：homepage/privacy/terms/favicon 200，`/api/health` `model=deepseek-v4-pro`、`samplingReady=true`，systemd `active`。
- 最新已推送提交（`zitao4588-create/geo-lab` main）：
  - `0ca1179` 报告提交与恢复可靠性（release `20260710114018`）
  - `ed5d836` 搜索发现性静态文件（release `20260708163730`）
- 验收证据：恢复可靠性见 `outputs/h5-mvp/idempotency-recovery-20260710/acceptance.md`；历史 UI/UX、微信号与 visual smoke 证据仍在各自 `outputs/h5-mvp/` release 目录。
- 交互要点（勿无意回退）：联系方式已从表单移除（联系只走结果页微信 CTA，API 仍兼容可选 contact）；提交按钮灰态可点击并定位缺失字段；429 显示页面内引导卡；表单草稿存 `sessionStorage`（`aiec_form_draft`）；待恢复请求存 `aiec_pending_request`；采样中挂 beforeunload 确认。
- 最新可靠性受控报告是 `diag_mrenc8ay_27tgnk`（虚构测试品牌，38 分，DeepSeek 20/20，`source=codex_prod_recovery` 只写内部 submission）。它只证明提交恢复，不可作为推广案例。`冰箱小雷达` 的正式受控案例仍是 `diag_mra0oo9j_xnru7x`。
- 线上恢复验证已闭环：首个客户端 5 秒超时，同 ID 重试返回 `200`，持久重放仍返回同一报告，不同 ID 返回 `429`，服务器只有一个 request index 和一条 submission，公开报告/证据包不泄露 request ID。
- 2026-07-08 新增搜索发现性入口：`/robots.txt` 返回 `text/plain`，`/sitemap.xml` 返回 `application/xml` 并列出首页、`/ai-exposure-check.html`、隐私、协议；`/ai-exposure-check.html` 是可直接抓取的静态介绍页和冰箱小雷达案例页。首页 `index.html` 已加 canonical、sitemap link 和 noscript fallback。

### 2.2 2026-07-06 Codex 同步补充

- 用户确认：这个 H5 只作为交付产品/报告入口，交易在别的端口或链路完成。
- 已做只读备案口径核验：当前备案展示和后台状态支持继续作为谨慎的交付/demo/report entry 使用；公开硬广、投流或更商业化的落地页口径仍需 ICP/Tencent 服务名称与公安备案 domain/from-domain 对齐。
- 当前边界：H5 内不放价格、支付、订单、合同、付费权益、发票/税务或退款流程；微信二维码只做报告后的咨询入口；页脚备案 caveat 继续保留。
- `marketing/` 物料初稿已于 2026-07-06 完成并提交 `c31873b`：公众号长文、知乎回答 ×2、小红书 ×3、朋友圈/群文案、短视频脚本、两张海报 PNG（HTML 源可复用重生成）。案例数字全部来自 outputs/ 真实报告（61→68、基建 0→100、提及率 40% 不变）。发布前按 `marketing/README.md` 红线清单逐条核对，发布动作由用户执行。
- 本地后续增量：`marketing/wechat-article-fridge-case.md` 已改成「去 AI 味版」，并新增 `marketing/image-prompts.md`（真实截图清单 + GPT Image 插画提示词）。这两项仍需纳入同步提交。
- 2026-07-06 后续完成：所有 GPT Image 配图和线上真实报告截图已生成并提交，公众号草稿已创建成功（不发布），`VITE_CONSULT_WECHAT_ID` 已用本地 ignored `.env.local` 构建进线上 release `20260706212541`；线上咨询弹层已验证显示可复制微信号。证据见 `outputs/h5-mvp/wechat-id-release-20260706212541/`。
- 2026-07-07 后续完成：首屏标题改为 `别让 AI / 只推荐竞品`，所有可见表单字段统一为单行输入，H5 读取 `?from=` / `?utm_source=` 并把 sanitized `source` 写入 `runtime/submissions.jsonl`。该字段只用于运营归因，不进入公开 report/evidence/export。线上 release `20260707095202` 已部署并通过 curl/systemd smoke。
- 2026-07-07 Codex 收尾：经用户明确同意，发起一次受控线上 POST 验证归因闭环，生成 `diag_mra0oo9j_xnru7x`；确认公开报告、Markdown、HTML、evidence package 均不暴露 `codex_test` / `source` / `contact`。随后用 Playwright 做移动端/桌面截图级 visual smoke，不再发第二次 POST；无横向溢出、无 console error/warning，咨询弹窗/二维码/微信号复制 UI 正常，稳定态评分环显示 `68`。Playwright 截图需 sandbox 外 headless Chromium；早截图会拍到 count-up 动画中途，稳定截图需等约 1 秒。

### 2.1 本轮 UI 焕新做了什么（设计意图，别无意破坏）

- 设计语言：深蓝墨色（navy）+ 单一品牌蓝 `#2e5ce6` + 琥珀金点缀；首页深色叙事 → 中间浅色文档感 → 结果页深色「报告封面」+ 深色 CTA 卡首尾呼应。设计令牌集中在 `src/client/styles/app.css` 顶部 `:root`。
- 首页：AI 对话演示卡（竞品 A/B + 金色虚线「你的品牌？」）是转化钩子；删除了原来不可点击的假 tab。
- 表单：字段分组「基础信息（必填）/ 补充信息（选填）」。
- 加载页：假进度只推进到第 4 步（`Math.min(current + 1, 3)`），最后一项保持脉冲直到真实结果返回——**不要改回全部完成**。
- 结果页：报告封面评分环颜色随 riskLevel 变化（low 绿/medium 琥珀/high 红）；未配置平台降噪为一行灰字；两个 CTA 按钮合并为一个。
- 深色报告封面是刻意做成「值得分享」的传播件，推广方案里的分享海报功能会复用它。
- **合规文案一字未动**：备案号、「备案展示以 exposure 子域名最终核验为准」、隐私/协议链接、证据边界与「不生成模拟结果」表述必须保留。

## 3. 服务器与部署事实（安全边界：服务器 IP、SSH 私钥、API key 一律不写入仓库）

- SSH：本机 `~/.ssh/config` 有别名 `lighthouse-lab`（user ubuntu，密钥 `lighthouse_lab_ed25519`，passwordless sudo 可用）。**别名可写文档，IP 不可。**
- 目录布局：`/opt/playgamelab/ai-exposure-check-h5/{releases/<ts>, current -> releases/<ts>, runtime, .env}`；runtime 现在还包含 `request-index/<clientRequestId>.json`。
- systemd：`ai-exposure-check-h5.service`。注意 **PORT=3020 和 RUNTIME_DIR（绝对路径）写在 unit 的 Environment= 里，不在 .env 里**；.env 只有 DEEPSEEK_* 三个键。`RUNTIME_DIR` 是共享绝对路径 → 切 release 不丢历史报告。
- Caddy 反代 `exposure.playgamelab.cn → 127.0.0.1:3020`；Node 只监听 127.0.0.1。
- 服务器 Node v22.23.0；限流为进程内存实现（1 份/IP/小时，30 份/天全局），**重启即清零**。
- 部署流程（本轮实测有效，无自动化脚本）：
  1. 本地 `npm run typecheck && npm run build`；
  2. 检查 bundle 无密钥（grep DEEPSEEK / sk- 形态；`sk-` 命中 TDesign 骨架屏类名属正常）；
  3. `rsync -az dist docs public package.json package-lock.json lighthouse-lab:/opt/.../releases/<ts>/`；
  4. 服务器 `npm ci --omit=dev`；
  5. 预检：release 目录里 `set -a; . ../../.env; set +a; PORT=8790 RUNTIME_DIR=/opt/.../runtime node dist/server/server/index.js`，curl health/homepage 后 kill（用 ss 查 pid，pkill 匹配不到环境变量）；
  6. `ln -sfn releases/<ts> current && sudo systemctl restart ai-exposure-check-h5.service`；
  7. 按 `apps/ai-exposure-check-h5/docs/production-runbook.md` 跑线上验收。
- 当前回滚：`ln -sfn /opt/playgamelab/ai-exposure-check-h5/releases/20260708163730 /opt/playgamelab/ai-exposure-check-h5/current && sudo systemctl restart ai-exposure-check-h5.service`
- 不记录易过期的 release 数量；需要清理时先逐项 inventory，再手动确认，禁止批量 rm。

## 4. 待办事项（按优先级；`TODO.md` 是正式清单，本节是执行视角汇总）

### P0 —— 推广启动的前置条件

| 事项 | 谁做 | 说明 |
|---|---|---|
| 备案/主体/收费边界 | 用户已配合后台核验，开发同步文档 | 结论：H5 维持交付/demo/report entry，不在 H5 内交易；公开硬广或投流前仍需确认/更新 ICP/Tencent 服务名称与公安备案 domain/from-domain。 |
| `?from=` 来源追踪 | 已完成 | release `20260707095202` 已读 query 参数并随 POST 写入 `submissions.jsonl`；`source=codex_test` 已受控验证。未接入访问统计或埋点 SDK；首批推广只做提交来源归因。 |
| 搜索发现性基础 | 已完成 | release `20260708163730` 已补 robots、sitemap、静态介绍页和首页 noscript fallback；这只是降低抓取门槛，不保证微信搜一搜立即收录或排名。 |
| 报告提交恢复 | 已完成 | release `20260710114018` 已支持同 request ID 的 in-flight/落盘恢复；真实断线验收和不同 ID `429` 均已通过。 |

### P1 —— 推广物料与产品增强

- 报告分享海报：深色报告封面 → 可保存图片（含二维码），小红书/朋友圈传播件。（429 软着陆已随 `f783016` 上线，不再是待办）
- 第二真实采样平台（豆包/Kimi/通义等，需用户提供对应 API key；adapter 结构已预留，见 `src/server/deepseek.ts` 的 providers 登记，未配置平台必须继续返回 unavailable，**禁止模拟结果**）。
- H5 内 PDF 导出按钮（当前 PDF 靠 HTML 报告手工生成）。
- `fridge.playgamelab.cn` 月度复测基线 + 给「AI曝光体检」自己做 GEO 自证（固定 20 题，公开提及率曲线，推广方案 §3）。

### P2 —— 后续

- 公众号 JSSDK 分享卡片（需认证公众号）。
- `agents/geo-diagnosis-agent/spec.md`、`agents/geo-content-refiner-agent/spec.md`（先写 spec 再谈 CLI）。
- 小程序复用方案（H5 验证需求后）。

## 5. 推广方案摘要（全文见 `knowledge/product/h5-promotion-plan.md`）

方案从四个硬约束反推，执行前必读全文：

1. **备案/服务名称/domain-from-domain 未对齐前 → 只能「内测邀请/个人项目分享」口径**，不投流不硬广，交易不在 H5 内完成；
2. **每天 30 份名额上限 → 目标是高意向填满，不是冲流量**；名额限制本身当卖点讲（「每份都是真实采样成本」）；
3. **单平台采样 → 所有素材禁止承诺 AI 排名/推荐提升**；
4. **微信号 + 来源追踪闭环已补齐**；下一步是小流量验证来源归因和咨询转化。

三阶段：阶段 0 补闭环+朋友圈试水（1-3 天）→ 阶段 1 内测口径内容播种 4 周（朋友圈/公众号/知乎/即刻/小红书，build in public 人设，两周后校准数据）→ 阶段 2 放大（双前提：备案通过 + 第二平台上线；短视频、异业合作、垂直群、才考虑投流）。

贯穿策略：GEO 自证（吃自己的狗粮，月度复测公开曲线）是最强信任资产。文档里备有首批素材草稿（朋友圈/知乎/公众号选题/短视频脚本/小红书标题）和发布前合规红线清单。

## 6. 必须遵守的边界（违反会破坏项目信任基础）

1. 证据边界：区分 raw_source / verified_external / sampled_ai_answer / model_inference / suggested_supplement；不虚构案例、引用、统计、评价；不承诺排名提升。
2. 无 key 或采样全失败 → `503 sampling_unavailable`，**永远不用规则模板冒充最终报告**。
3. 密钥管理：DEEPSEEK key 只在本地 `.env.local`（gitignored）和服务器 `.env`；不进仓库、bundle、日志、报告。服务器 IP 不写入任何项目文档。
4. `sources/` 原始快照 append-only。
5. 合规文案（备案号 + caveat + 隐私/协议）保持展示；H5 维持交付/report/demo 入口，不承载交易、支付、订单或合同。
6. 与用户中文沟通；改文件前先说明改哪些、为什么（`AGENTS.md`）。

## 7. 本轮踩坑记录（避免重复付学费）

1. **`fill-mode: both` 残留恒等 transform**：`.screen` 入场动画曾把 `position: fixed` 的咨询弹层劫持出视口（恒等矩阵也算 containing block）。已修复——`.screen` 动画不要加 fill-mode，弹层也别移进带 transform 的容器。
2. **限流测试要在窗口内做**：IP 窗口 1 小时。窗口过期后重复 POST 返回 201 是正确行为；上轮因此误产生一份垃圾报告并白烧 20 次采样。验证 429 要在同窗口内立刻重发（被拒时零成本）。
3. **`POST /api/diagnoses` 仍可能较慢**（20 题采样 + polish）。2026-07-10 真实受控运行从首个采样到完整落盘约 76.3 秒；客户端超时不等于服务端失败，同一表单重试必须复用 `aiec_pending_request`，不要生成新 request ID。
4. macOS 自带 rsync 是 2.6.9：不支持 `--info=`，用 `--stats`。
5. Playwright 升级后需 `npx playwright install chromium` 重下浏览器。
6. Vite 会把 `public/` 拷进 `dist/client`；服务端只 serve `dist/client`（release 里独立的 `public/` 目录只是随包，未被 serve）。
7. TDesign 样式覆盖：主按钮渐变需要 `.primary-action.t-button` 双类压过 `.t-button--primary`；输入框聚焦态用 `.field:focus-within` 包一层做。
8. 本地预览：`.claude/launch.json` 已配置 vite dev server（gitignored）；本地 API 在 8787，vite 代理 `/api`。
9. 预检 SSH 中断不一定会带走远端 Node；切换前必须用 `ss` 确认 `8790` 已释放，只终止本轮明确 PID。

## 8. 快速自检（新会话接手后 5 分钟）

```bash
# 线上
curl -sSI https://exposure.playgamelab.cn/ | head -2
curl -sS https://exposure.playgamelab.cn/api/health
# 服务器
ssh lighthouse-lab 'systemctl is-active ai-exposure-check-h5.service; readlink /opt/playgamelab/ai-exposure-check-h5/current'
# 本地
cd apps/ai-exposure-check-h5 && npm run typecheck
```

预期：200 / `samplingReady=true` / `active` / current 指向 `20260710114018` / typecheck 通过。
