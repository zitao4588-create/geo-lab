# H5 报告提交与恢复可靠性受控验收

- 验收时间：2026-07-10 11:23 CST
- 验收范围：本地构建、API 幂等恢复、限流保持、失败路径、真实浏览器断网/刷新/重提
- 验收环境：本地 Node/Express + Playwright CLI + 本地 OpenAI-compatible 假模型
- 成本边界：未调用生产 DeepSeek，未消耗线上免费名额，未修改 `sources/`

## 静态与自动化验证

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck` | 通过 |
| 生产构建 | `npm run build` | 通过 |
| 幂等集成测试 | `npm test` | 2/2 通过 |
| Diff 格式检查 | `git diff --check` | 通过 |

集成测试覆盖：

1. 首次请求到达模型后主动断开客户端连接。
2. 同一 request ID 在生成中重试，返回同一份报告，不重复调用生成链路。
3. 同一 request ID 在报告落盘后再次重试，返回同一报告 ID。
4. 服务进程重启后，同一 request ID 从磁盘索引恢复同一报告。
5. 同一 request ID 搭配不同表单内容返回 `409 idempotency_conflict`。
6. 不同 request ID 在同一 IP 小时窗口内仍返回 `429 rate_limited`。
7. 非法 request ID 返回 `400 validation_error`，不调用模型。
8. 模型全部失败时，并发的同 ID 请求共享同一失败，均返回 `503 sampling_unavailable`，不生成报告或请求索引。
9. request ID 不进入 `submissions.jsonl` 或公开 evidence package。

## 浏览器断网恢复验收

受控步骤：

1. 在真实浏览器填写 5 个必填字段并提交。
2. 服务端开始 20 个标准问题采样后，将浏览器网络切为离线，制造响应不可达。
3. 前端回到表单后恢复网络并刷新页面。
4. 重新进入表单，使用草稿再次提交。
5. 页面成功进入报告结果，而不是显示免费额度已用完。

验收结果：

- request ID：`req_a8a1e759-cef7-4206-9f59-7cebfc351b57`
- report ID：`diag_mredbjdh_wnuvlo`
- 报告采样：受控假模型 `20/20`
- runtime 诊断文件：`1`
- runtime request 索引：`1`
- `submissions.jsonl`：`1` 行
- 结果页：成功加载 `?report=diag_mredbjdh_wnuvlo`
- 额度卡：未出现
- 控制台：仅有故意离线时 favicon 的 `net::ERR_INTERNET_DISCONNECTED`，无应用异常

限流证明：首次提交已经占用本地配置的唯一 IP 小时名额。如果刷新后的前端生成了新 request ID，第二次提交只能得到 `429`；实际成功进入同一报告，因此重提复用了原 request ID，并通过服务端持久索引恢复。

## 生产部署与线上恢复验收

- 代码提交：`0ca1179 Fix H5 diagnosis retry recovery`
- 生产 release：`20260710114018`
- 回滚 release：`20260708163730`
- 部署 smoke：systemd `active`，homepage/health/robots/sitemap/静态介绍页/既有报告及导出均正常。
- 线上前端 bundle：`assets/index-au-6pj8j.js`，包含 `aiec_pending_request` 恢复状态。
- 公网非法 request ID 探针：`400 validation_error`，未调用模型。

经用户单独授权，执行了一次真实 DeepSeek 受控提交：

1. 使用 request ID `req_prod_recovery_20260710155933` 提交标准 20 题诊断。
2. 第一客户端在 5.005 秒后主动超时，得到 curl `28` / HTTP `000`，模拟响应丢失。
3. 立即以完全相同 payload 和 request ID 重试，最终返回 `200`，而不是新建报告的 `201` 或限流 `429`。
4. 报告落盘后再次重放同一 request ID，1.146 秒内返回 `200` 和同一报告。
5. 只替换为新的 request ID 后提交，0.938 秒内返回 `429 rate_limited`，未再次调用模型。

生产验收结果：

- report ID：`diag_mrenc8ay_27tgnk`
- 模型：`deepseek-v4-pro`
- 真实采样：`20/20`
- request index：指向 `diag_mrenc8ay_27tgnk`
- `submissions.jsonl`：该报告仅 `1` 行
- 服务错误级日志：无记录
- 公开报告与 evidence package：不包含 request ID 或 `clientRequestId`
- 采样开始：`2026-07-10T07:59:52.739Z`
- request index 落盘：`2026-07-10T08:01:09.046Z`
- 从首个采样开始到完整落盘：约 `76.3` 秒
- 单题平均延迟：`9285ms`；最大延迟：`16979ms`

## 剩余边界

- 本地假模型报告不得作为 GEO 案例或业务证据；生产受控报告也只是提交可靠性证据，不是产品效果案例。
- 前三次浏览器自动化尝试因 CLI 启动和 `beforeunload` 时序不能证明响应丢失，未计入验收结论；最终本地验收使用浏览器离线流程闭环。
- 本次生产受控提交会占用发起 IP 的一小时免费名额；同一出口 IP 约到 2026-07-10 17:00 CST 后恢复，新 IP 不受该小时窗口影响。
- 限流仍为单进程内存实现，服务重启会清零；request index 是共享 runtime 下的本地 JSON 文件，当前只适用于单实例部署。
- 本次真实耗时再次证明页面现有“20-60 秒”提示偏乐观；文案或采样提速应另开任务，不属于本轮可靠性改动。
