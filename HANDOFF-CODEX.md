# Codex 交接文档

交接日期：2026-07-05
交接人：Claude Code（本轮完成 H5 UI 焕新 + 生产部署 + 推广方案）
阅读顺序建议：本文档 → `AGENTS.md` → `PROJECT_CONTEXT.md` → `TODO.md` → 按任务读源码

---

## 1. 项目一句话

「AI曝光体检」：免费 H5 工具，用户填 30 秒业务资料，系统拿 20 个真实问题调 DeepSeek 官方 API 采样，生成带原始答案证据的 GEO 分析报告；转化目标是加微信 → 付费人工完整体检/GEO 优化服务。

- 线上入口：`https://exposure.playgamelab.cn`
- 代码位置：`apps/ai-exposure-check-h5/`（React+Vite+TDesign Mobile / Node+Express，无数据库/登录/支付）
- 第一阶段红线：不引入数据库、登录、支付、Docker、队列（见 `AGENTS.md`）

## 2. 当前线上状态（截至 2026-07-05 晚）

- **线上 release：`20260705175108`（UI 焕新版）**，上一版 `20260703201836` 保留在服务器可回滚。
- 服务健康：homepage/privacy/terms 200，`/api/health` `model=deepseek-v4-pro`、`samplingReady=true`，systemd `active`。
- 本轮 git 提交（已推送 `zitao4588-create/geo-lab` main）：
  - `dc6b59d` Redesign H5 UI for premium feel and conversion —— UI 焕新本体
  - `249799b` Record UI refresh production deployment 20260705175108
  - `7a44ede` Record rate-limit verification and TODO closeout
  - `070ff36` Add H5 promotion plan draft v1
- 验收证据：`outputs/h5-mvp/ui-refresh-release-20260705175108/`（部署摘要、smoke 报告、导出、线上四屏截图）。
- 线上 smoke 报告：`diag_mr7m81bl_mzlv8i`（42 分，20/20 采样）。另有一份垃圾测试报告 `diag_mr7saxjg_8u68br`（限流测试失误产物，可忽略，勿引用）。

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
- 目录布局：`/opt/playgamelab/ai-exposure-check-h5/{releases/<ts>, current -> releases/<ts>, runtime, .env}`
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
- 回滚：`ln -sfn /opt/playgamelab/ai-exposure-check-h5/releases/20260703201836 /opt/playgamelab/ai-exposure-check-h5/current && sudo systemctl restart ai-exposure-check-h5.service`
- 服务器现有 5 个 release，磁盘 30%，暂不清理；稳定后可手动删最老两个（禁止批量 rm）。

## 4. 待办事项（按优先级；`TODO.md` 是正式清单，本节是执行视角汇总）

### P0 —— 推广启动的前置条件

| 事项 | 谁做 | 说明 |
|---|---|---|
| 备案口径复核 | **仅用户可做** | 登录 ICP/公安备案后台或问接入商，确认 exposure 子域名与主体能否公开商业推广。**这是推广阶段 2 的硬门槛**，完成前只能内测口径（不投流、不硬广）。 |
| 配置 `VITE_CONSULT_WECHAT_ID` | 用户给微信号 → 开发执行 | Vite 构建期变量（写入本地 `.env.local`，不进仓库），改完需重新构建+部署。当前弹层只有二维码可用，复制按钮只能复制「添加说明」。 |
| `?from=` 来源追踪 | 开发 | 首页读 query 参数，随 POST 提交写入 `submissions.jsonl`（需同步改 `validation.ts` schema 与前端 `api.ts`/`App.tsx`）。没有它推广渠道无法归因。当前项目**零访问统计**。 |

### P1 —— 推广物料与产品增强

- 报告分享海报：深色报告封面 → 可保存图片（含二维码），小红书/朋友圈传播件。
- 429 软着陆：名额用完时给「明日名额 + 扫码预约」引导卡（当前只有 Toast 文案）。
- 第二真实采样平台（豆包/Kimi/通义等，需用户提供对应 API key；adapter 结构已预留，见 `src/server/deepseek.ts` 的 providers 登记，未配置平台必须继续返回 unavailable，**禁止模拟结果**）。
- H5 内 PDF 导出按钮（当前 PDF 靠 HTML 报告手工生成）。
- `fridge.playgamelab.cn` 月度复测基线 + 给「AI曝光体检」自己做 GEO 自证（固定 20 题，公开提及率曲线，推广方案 §3）。

### P2 —— 后续

- 公众号 JSSDK 分享卡片（需认证公众号）。
- `agents/geo-diagnosis-agent/spec.md`、`agents/geo-content-refiner-agent/spec.md`（先写 spec 再谈 CLI）。
- 小程序复用方案（H5 验证需求后）。

## 5. 推广方案摘要（全文见 `knowledge/product/h5-promotion-plan.md`）

方案从四个硬约束反推，执行前必读全文：

1. **备案未复核完 → 只能「内测邀请/个人项目分享」口径**，不投流不硬广，付费只在微信内谈；
2. **每天 30 份名额上限 → 目标是高意向填满，不是冲流量**；名额限制本身当卖点讲（「每份都是真实采样成本」）；
3. **单平台采样 → 所有素材禁止承诺 AI 排名/推荐提升**；
4. **先补转化闭环（微信号 + 来源追踪）再开始**。

三阶段：阶段 0 补闭环+朋友圈试水（1-3 天）→ 阶段 1 内测口径内容播种 4 周（朋友圈/公众号/知乎/即刻/小红书，build in public 人设，两周后校准数据）→ 阶段 2 放大（双前提：备案通过 + 第二平台上线；短视频、异业合作、垂直群、才考虑投流）。

贯穿策略：GEO 自证（吃自己的狗粮，月度复测公开曲线）是最强信任资产。文档里备有首批素材草稿（朋友圈/知乎/公众号选题/短视频脚本/小红书标题）和发布前合规红线清单。

## 6. 必须遵守的边界（违反会破坏项目信任基础）

1. 证据边界：区分 raw_source / verified_external / sampled_ai_answer / model_inference / suggested_supplement；不虚构案例、引用、统计、评价；不承诺排名提升。
2. 无 key 或采样全失败 → `503 sampling_unavailable`，**永远不用规则模板冒充最终报告**。
3. 密钥管理：DEEPSEEK key 只在本地 `.env.local`（gitignored）和服务器 `.env`；不进仓库、bundle、日志、报告。服务器 IP 不写入任何项目文档。
4. `sources/` 原始快照 append-only。
5. 合规文案（备案号 + caveat + 隐私/协议）保持展示，直到备案复核完成。
6. 与用户中文沟通；改文件前先说明改哪些、为什么（`AGENTS.md`）。

## 7. 本轮踩坑记录（避免重复付学费）

1. **`fill-mode: both` 残留恒等 transform**：`.screen` 入场动画曾把 `position: fixed` 的咨询弹层劫持出视口（恒等矩阵也算 containing block）。已修复——`.screen` 动画不要加 fill-mode，弹层也别移进带 transform 的容器。
2. **限流测试要在窗口内做**：IP 窗口 1 小时。窗口过期后重复 POST 返回 201 是正确行为；上轮因此误产生一份垃圾报告并白烧 20 次采样。验证 429 要在同窗口内立刻重发（被拒时零成本）。
3. **`POST /api/diagnoses` 可能超过 3 分钟**（20 题采样 + polish）。客户端 curl 超时 ≠ 失败，Express 会继续处理并落盘；以 `runtime/diagnoses/` 或 GET 查询为准。
4. macOS 自带 rsync 是 2.6.9：不支持 `--info=`，用 `--stats`。
5. Playwright 升级后需 `npx playwright install chromium` 重下浏览器。
6. Vite 会把 `public/` 拷进 `dist/client`；服务端只 serve `dist/client`（release 里独立的 `public/` 目录只是随包，未被 serve）。
7. TDesign 样式覆盖：主按钮渐变需要 `.primary-action.t-button` 双类压过 `.t-button--primary`；输入框聚焦态用 `.field:focus-within` 包一层做。
8. 本地预览：`.claude/launch.json` 已配置 vite dev server（gitignored）；本地 API 在 8787，vite 代理 `/api`。

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

预期：200 / `samplingReady=true` / `active` / current 指向 `20260705175108` / typecheck 通过。
