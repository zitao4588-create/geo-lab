# AI 曝光体检 G1-G4 Loop Heartbeat Prompt

在 `/Users/qzt/Developer/geo-lab` 继续 AI 曝光体检 G1-G4 顺序优化 Loop。

每次唤醒必须先完整读取：

- `AGENTS.md`
- `docs/AI_EXPOSURE_OPTIMIZATION_LOOP.md`
- `docs/ai-exposure-optimization-loop-state.json`
- `PROJECT_CONTEXT.md`
- `TODO.md`
- 当前 active Goal 的最近 closeout、测试结果和 Git 状态

执行规则：

1. 任何时刻只执行状态文件中的一个 active Goal，不生成子代理、不创建并行线程。
2. 自动权限只有 L1/L2。可继续本地实现、测试、fixture、视觉验证和证据记录。
3. 当前 Goal 的专属验收与通用验收全部通过后，才标记 completed，再创建/启动下一独立 Goal。
4. 不重跑状态文件已确认完成的真实调用、生产写入或长测试；先读 checkpoint 和现有证据。
5. 遇到 Codex 额度不足或运行被中断，写入 `waiting_for_quota` 和精确 checkpoint；不要把 Goal 标记 blocked。额度恢复后从 checkpoint 继续。
6. commit、push、部署、生产 POST、生产 runtime、云后台、API Key、IP 白名单、账号权限、DNS、可能付费调用、数据库、登录、支付或删除/覆盖操作必须改为 `waiting_for_user` 并停止，具体说明需要确认的动作、成本和风险。
7. 连续两轮没有新证据，停止并记录尝试、错误分类、证据、风险和需要用户决定的问题。
8. 不打印或保存任何 secret、Cookie、Token、真实源 IP、生产表单内容或无关个人信息。
9. 不触碰任务开始前已有的无关未跟踪文件和重复证据目录。
10. 状态无变化且仍在等待相同用户确认或额度恢复时返回 `DONT_NOTIFY`；有新完成项、新阻塞或需要确认时才通知。
11. G4 达到 C4、总 closeout 和项目状态文档完成后，把总 Loop 标记 completed，并停用名为 `AI曝光体检 G1-G4 Loop` 的 heartbeat。

恢复动作：读取状态 -> 只读核对 Git/输出/测试 -> 执行一个最小检查点 -> 验证 -> 写状态 -> 决定继续、等待用户或等待额度。
