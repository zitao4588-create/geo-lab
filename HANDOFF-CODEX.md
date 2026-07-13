# Codex 交接文档

交接日期：2026-07-14

交接范围：AI曝光体检测量有效性、联网候选发现、免费 H5 与正式报告分层、生产发布和 GitHub 同步。

阅读顺序：本文档 → `AGENTS.md` → `README.md` → `PROJECT_CONTEXT.md` → `TODO.md` → 按任务读取证据或源码。

## 0. 最新恢复点

- 唯一项目路径：`/Users/qzt/Developer/geo-lab`；H5 位于 `apps/ai-exposure-check-h5/`。
- 当前分支：`main`。功能、研究证据和正式报告工作流提交为 `c85f9ef`，已推送到私有 `origin/main`；本交接文档与状态文件由其后的 closeout 文档提交同步。
- 当前生产 release：`20260714004607`；上一 release `20260713132053` 保留回滚。服务 `ai-exposure-check-h5.service` 为 active，Node 仅监听 `127.0.0.1:3020`，公网入口为 `https://exposure.playgamelab.cn`。
- 生产 health：DeepSeek、Hy3、Qwen、Doubao 为 4 configured / 4 samplingAllowed；Volcengine 与 AnySearch 两个公开网页候选来源均 active。
- 本轮发布未提交新的生产 `POST /api/diagnoses`，未新增生产报告，也未为发布验收额外调用四模型。
- 新 release 的静态页、既有报告、evidence、Markdown、HTML、evidence package 均返回 200；服务端入口、前端入口和主 JS bundle 的本地/线上 SHA-256 一致。
- 本地最终验证：typecheck、92/92 tests、release precheck、15 个前端文件密钥扫描和 authored-file diff check 通过。
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
- 新搜索 release 当前为 C3：代码已部署并完成只读公网验收；因为没有新生产报告，四模型 + 两路搜索整单仍未达到新的 C4 证据。

回滚需要同时恢复 release 和部署前环境文件：

```bash
cp /opt/playgamelab/ai-exposure-check-h5/.env.before-20260714004607 /opt/playgamelab/ai-exposure-check-h5/.env
ln -sfn /opt/playgamelab/ai-exposure-check-h5/releases/20260713132053 /opt/playgamelab/ai-exposure-check-h5/current
sudo systemctl restart ai-exposure-check-h5.service
```

## 5. 当前唯一下一步

出现首个合格客户实体时，只跑 1 份内部正式报告 dry run：严格按 `workflows/formal-consumer-report/WORKFLOW.md` 采集四消费端、核验来源、评分并做交付质量检查。

不要再用 AI曝光体检或冰箱小雷达自身做这一轮目标实体，不扩大 H5 API 测试，不公开宣传测量有效性结果。

首份自然 H5 提交只做被动运营观察：记录总耗时、模型成功率、火山/AnySearch 状态和候选合并结果；这不是主动制造生产报告的授权。

## 6. 仍未解决

- 四模型 + 两路搜索生产整单能否稳定在 30 秒内完成。
- AnySearch 匿名公开商业条款和长期免费可用性。
- Volcengine 联网与模型 token 的实际生产扣费边界。
- 正式报告工作流是否能在真实客户实体上稳定完成并产生愿意付费的价值。
- 真实用户咨询、转化、复购或业务结果；项目整体仍不是 C5。
- 微信公众号 JSSDK 账号侧接入继续暂停：现有公众号为个人主体、未认证、JS 安全域名未设置。只支持普通分享/复制 fallback。

## 7. 未纳入提交的本地文件

以下文件属于其他任务或临时运行，不要在新会话里误当成本轮待提交内容：

- `.playwright-cli/`
- `marketing/posters/poster-square-no-url.png`
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

预期：`origin/main` 包含 `c85f9ef` 和其后的 closeout 文档提交；公网 200；systemd active；current 指向 `20260714004607`；health 显示四模型允许采样、Volcengine 与 AnySearch active。
