# Codex 交接文档

交接日期：2026-07-15

交接范围：AI曝光体检测量有效性、真实环境 E2E、免费 H5 与正式报告分层、分数一致性修复、生产发布和 GitHub 同步。

阅读顺序：本文档 → `AGENTS.md` → `README.md` → `PROJECT_CONTEXT.md` → `TODO.md` → 按任务读取证据或源码。

## 0. 最新恢复点

- 唯一项目路径：`/Users/qzt/Developer/geo-lab`；H5 位于 `apps/ai-exposure-check-h5/`。
- 当前分支：`main`。一跳官方页面发现功能提交为 `68aeddc`，已推送到私有 `origin/main`；本交接文档与证据由其后的 closeout 文档提交同步。
- 当前生产 release：`20260715140741`；上一 release `20260715023611` 保留回滚。服务 `ai-exposure-check-h5.service` 为 active，Node 仅监听 `127.0.0.1:3020`，公网入口为 `https://exposure.playgamelab.cn`。
- 生产 health：DeepSeek、Hy3、Qwen、Doubao 为 4 configured / 4 samplingAllowed；Volcengine 与 AnySearch 两个公开网页候选来源均 active。
- 本轮修复发布未提交新的生产 `POST /api/diagnoses`，未新增生产报告，也未调用模型或搜索。
- 新 release 的 11 个静态页、既有报告、evidence、Markdown、HTML、evidence package 路径均返回 200；`pageAudit.js` 本地/线上 SHA-256 一致。
- 本地最终验证：typecheck、96/96 tests、build、release precheck 13/13、18 个前端与本次证据文件密钥扫描和 authored-file diff check 通过。
- 生产 `current` 构建的无网络隔离断言确认 flomo 可发现 `help.flomoapp.com` 帮助与隐私入口；没有创建第 4 份生产报告，真实站点基建分和建议文本仍未验证。
- 生产真实浏览器复用既有报告 `diag_mrkv2jj7_tb6z1c`：首次加载和刷新均显示封面 61、桌面预览“61分 · 一般”；刷新变化历史只有一次 61，控制台 0 error / 0 warning。
- 原始 API/消费端回答、截图、搜索返回和生成报告保持逐字不变，因此原始 evidence 中的尾随空格不做格式化。

## 1. 当前产品结论

### 1.1 测量有效性

2026-07-13 完成 4 个外部实体 × 4 条统一提示词 × 4 个 API 与 4 个消费端的对照验证：

- API：64 个主样本，63 成功、1 超时；当时产品 API 路径未联网。
- 消费端：64 次独立新会话，57 条可评分、7 条异常；33/57 显示自动联网。
- 两个目标实体严格品牌认知方向：2/8 一致、5/8 冲突、1/8 不可比较。
- 正对照有效；负对照在豆包 API 出现一次严重编造。
- 正式判定：C/红色。

结论只否定“离线 API 可以代表四个消费端默认体验”。不得把 API 未提及写成消费端未曝光，也不得把消费端单次回答写成稳定排名。

证据：`outputs/h5-mvp/measurement-validity-20260713/decision.md`。

### 1.2 双层产品路线

免费 H5：

- 四模型 API 使用同一套默认 10 个问题并行采样。
- 审计用户提交的公开页面。
- Volcengine + AnySearch 在后端并行发现候选公开来源。
- 输出“初步诊断分”，用于发现品牌认知、已提交来源和公开证据可发现性问题。
- 不代表 DeepSeek、通义、腾讯元宝、豆包消费端实时搜索、曝光或排名。

正式客户报告：

- 固定入口：`workflows/formal-consumer-report/WORKFLOW.md`。
- 使用四消费端独立新会话、完整回答、截图、链接、公开来源逐条核验和人工评分。
- 每次只处理一个实体，最多 40 次消费端交互；不导入 Cookie、不绕过验证码、不购买、不自动对外发送。
- H5 报告只能作为背景材料，不能自动升级成正式报告。

### 1.3 真实环境 E2E 结论

2026-07-14 至 2026-07-15 用 Cubox、徕芬 Mini、遇见长安赛格店走真实 H5 和四消费端协议：

- H5 创建 2/3 份生产报告；遇见长安因当前营业状态冲突在提交前按停止条件终止。两份完成报告耗时 34.921 秒和 27.979 秒，fallback 均为 0。
- 消费端共执行 67 次提交/允许重开动作；120 个计划单元中 64 个有效、1 个失败、55 个 missing，只有 Cubox 达到 40/40 完整回答。
- 判定：Cubox“带保留可交付”；徕芬 Mini、遇见长安赛格店“不可交付”。主要阻断是消费端域名访问/截图不完整、规格或门店范围污染，以及动态营业状态无法由一手来源确认。
- 正式工作流能发现 H5 看不到的同名实体污染、无效引用和条款编造，方法本身有交付价值；当前优先客户应是有稳定官网、帮助中心和清晰产品边界的软件产品。
- 真实运行证据保存在未纳入 Git 的 `outputs/customer-reports/`。原总结中的 42/43 与 61 被后续复查定位为刷新时数字递增的中间帧；修复后线上只显示最终 61。

## 2. H5 联网候选发现实现

- `src/server/providers/webSearch.ts`：AnySearch、Tavily、Jina、Volcengine 统一适配器；默认全部关闭；错误会脱敏。
- `src/server/publicWebGrounding.ts`：选择多 provider、并行执行、URL 去重、品牌/官网候选识别和公开证据可发现度评分。
- `POST /api/diagnoses`：PageAudit 完成后，四模型与搜索在共享整单截止时间内并行；搜索失败会显式降级，不伪造结果。
- evidence 新增 `public-web-search.json`，保留每个搜索来源的完整原始响应；candidate 始终是 `suggested_supplement`。
- 报告总分改称“初步诊断分”。有搜索时权重为 AI 可见度 30%、公开证据发现 15%、基建 20%、竞品 15%、内容 12%、信任 8%。
- 前端显示搜索来源状态、候选 URL 的来源 provider、发现指标和显著的消费端边界；完整报告 CTA 指向消费端数据、引用、截图与人工核验。

生产仅启用：

- `PUBLIC_WEB_GROUNDING_PROVIDERS=volcengine,anysearch`
- `VOLCENGINE_SEARCH_ENABLED=true`
- `ANYSEARCH_SEARCH_ENABLED=true`
- `ANYSEARCH_ALLOW_ANONYMOUS=true`
- `DIAGNOSIS_SLA_MS=30000`
- `DIAGNOSIS_REPORT_RESERVE_MS=2500`

不要把这些非敏感开关与生产密钥写入同一份项目证据；真实 key 只在服务器 mode 600 的 `.env`。

## 3. 搜索 canary 结论

- 没有 provider 通过原定全部硬门槛。
- AnySearch：12/12 请求成功，P95 约 7.0 秒，候选发现价值最高；但公开商业条款未确认。
- Tavily：12/12 成功且快，但官方来源覆盖不足，生产未启用。
- Jina：4/12 成功、多个 12 秒超时，生产未启用；已获取的 Jina key 不进入生产 H5。
- Volcengine：插件开通后，单条 30 秒窗口在约 21.7 秒成功；没有扩跑全部案例。
- 隔离整链路 canary 在 27.535 秒返回完整报告结构，但只完成 37/40 个模型回答；只能证明并行路线可行，不能证明生产 P95 或稳定 30 秒。

证据：`outputs/h5-mvp/search-grounding-canary-20260713/decision.md`。

## 4. 生产边界与回滚

- 服务器布局：`/opt/playgamelab/ai-exposure-check-h5/{releases/<ts>,current,runtime,.env}`。
- runtime 为共享绝对路径；切 release 不丢历史报告、request index 或持久限流。
- 限流保持每 IP 每小时 1 份、全局每天 30 份；单实例状态持久化，客户端标识只保存加盐哈希。
- AnySearch 匿名接口已从生产服务器验证 HTTP 200，但长期稳定性和公开商业使用条款尚未被技术验收证明。
- Volcengine 搜索调用可能产生额外模型 token；出现收费、额度、授权或稳定性异常时，独立关闭对应搜索开关并重启服务。
- 搜索增强 release 已有两份真实生产整单证据；本次分数一致性 release 是既有 C4 核心流程的维护发布。没有真实客户反馈、付费或业务结果，因此仍不是 C5。

回滚需要同时恢复 release 和部署前环境文件：

```bash
cp /opt/playgamelab/ai-exposure-check-h5/.env.before-20260715023611 /opt/playgamelab/ai-exposure-check-h5/.env
ln -sfn /opt/playgamelab/ai-exposure-check-h5/releases/20260714004607 /opt/playgamelab/ai-exposure-check-h5/current
sudo systemctl restart ai-exposure-check-h5.service
```

## 5. 当前唯一下一步

在四消费端访问和截图链路都可用后，只跑 1 个有稳定官网与帮助中心的软件产品，原样复跑正式协议；有效回答和一一对应截图均达到 75% 后，再决定是否对外销售完整报告。

暂不先扩到实体产品或本地服务，不用 API 补消费端缺口，不公开宣传稳定排名或推荐提升。首份自然 H5 提交继续只做被动运营观察。

## 6. 仍未解决

- 四模型 + 两路搜索生产整单能否稳定在 30 秒内完成。
- AnySearch 匿名公开商业条款和长期免费可用性。
- Volcengine 联网与模型 token 的实际生产扣费边界。
- 四消费端访问与截图链路能否稳定达到 75% 证据完整率；当前 3 份中只有 Cubox 回答覆盖达标，且元宝缺截图。
- 正式报告的事实与风险清单已证明有内部交付价值，但真实客户是否愿意付费仍未验证。
- 真实用户咨询、转化、复购或业务结果；项目整体仍不是 C5。
- 微信公众号 JSSDK 账号侧接入继续暂停：现有公众号为个人主体、未认证、JS 安全域名未设置。只支持普通分享/复制 fallback。

## 7. 未纳入提交的本地文件

以下文件属于其他任务或临时运行，不要在新会话里误当成本轮待提交内容：

- `.playwright-cli/`
- `marketing/posters/poster-square-no-url.png`
- `outputs/customer-reports/`
- `outputs/h5-mvp/source-recognition-hardening-20260712/stage-b-runtime/`

禁止批量删除；如需处理，先逐项判断归属。

## 8. 五分钟只读自检

```bash
git status --short --branch
git log -3 --oneline --decorate
curl -sSI https://exposure.playgamelab.cn/ | head -2
curl -sS https://exposure.playgamelab.cn/api/health
ssh lighthouse-lab 'systemctl is-active ai-exposure-check-h5.service; readlink -f /opt/playgamelab/ai-exposure-check-h5/current'
```

预期：`origin/main` 包含 `68aeddc` 和其后的 closeout 文档提交；公网 200；systemd active；current 指向 `20260715140741`；health 显示四模型允许采样、Volcengine 与 AnySearch active。
