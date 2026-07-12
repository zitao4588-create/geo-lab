# G4 生产验收

状态：通过，达到 C4；未达到 C5。

## 授权与成本边界

- 用户明确要求跳过三家云后台额度核验，直接部署和生产验收，并接受本次调用可能产生费用。
- 腾讯 Hy3 与火山 Doubao 的生产成本许可仅开放到 `2026-07-12T20:30:00Z`，不是永久授权。
- 本次只生成一份新生产报告；同 request ID 重放只恢复同一份持久化报告。

## 部署

- 分支：`codex/ai-exposure-optimization-g1-g4`
- 功能提交：`000fd1a`
- 授权检查点提交：`48f20e4`
- 新 release：`20260713012534`
- 上一 release：`20260712095412`，保留用于回滚。
- 临时端口 8790：4/4 provider 允许采样，首页 200；临时进程退出后端口为空。
- 生产：`current` 指向新 release，`ai-exposure-check-h5.service` 为 active。
- 公网首页、health、robots、sitemap、介绍页、功能页、FAQ、案例页和 `llms.txt` 全部返回 200。

## 唯一生产报告

- 报告 ID：`diag_mri2hznd_fg6z69`
- 受控样本：AI曝光体检自身公开介绍页，不含联系信息或私密数据。
- 首次 POST：201。
- 同 request ID、同 payload 重放：200，返回同一报告 ID；未生成第二份报告。
- 四模型采样：DeepSeek 10/10、Hy3 10/10、Qwen 10/10、Doubao 10/10；合计 40/40，失败 0，fallback 0。
- 报告：54/100（一般）；字符串出现率 47.5%，正确实体识别 0%，无品牌词自然推荐 0%，记录 8 组模型冲突。
- 提交来源 100/100，站点基建 100/100；这些结果只描述本次固定问题采样，不代表排名或流量提升。

## 恢复、持久化与导出

- request-index 指向同一报告，request fingerprint 为 64 位十六进制摘要。
- 受控来源在 submissions 中只新增 1 行；证据目录包含 8 个文件。
- 报告查询、证据索引、Markdown、HTML、evidence package 和公开报告页全部返回 200。
- H5、Markdown、HTML、evidence package 均显示 54 分。
- 公开响应和导出未出现 `clientRequestId`、本次 request ID 或内部来源标签。

## 运行观测

- PageAudit：276 ms；采样：29,202 ms；总耗时：29,240 ms。
- DeepSeek P50/P95：9,135/14,207 ms；最慢 P006。
- Hy3 P50/P95：5,509/8,773 ms；最慢 P013。
- Qwen P50/P95：9,851/11,184 ms；最慢 P003。
- Doubao P50/P95：9,927/13,255 ms；最慢 P013。

## 生产视觉验收

- 正确分享 URL 为 `/?report=diag_mri2hznd_fg6z69`；`/report/<id>` 只是 SPA fallback，不会加载指定报告。
- 390×844：54 分、40/40、证据边界与模型冲突可见；无横向溢出，无 console error/warning。
- 1440×1000：报告卡与桌面摘要一致；无横向溢出，无 console error/warning。

## 完成等级

- G1：C2。
- G2：C2。
- G3：C2。
- G4：C4。
- 总 Loop：C4。真实用户可以打开报告、刷新恢复并读取证据与导出；尚无真实用户反馈、持续数据或收益证据，因此不是 C5。
