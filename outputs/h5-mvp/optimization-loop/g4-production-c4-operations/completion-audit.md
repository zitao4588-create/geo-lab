# G4 L2 完成审计

- [x] health 分离配置、成本门、最近真实成功。
- [x] 腾讯/火山未知或过期成本门 fail-close，0 provider 请求。
- [x] provider/模型成功率、失败类型、fallback、P50/P95、最慢 Prompt ID、PageAudit/采样/总耗时持久化且不含输入全文。
- [x] 限流持久化、原始 IP 哈希、重启恢复与并发串行消费。
- [x] DeepSeek/Doubao fallback、部分失败、丢响应、重复 ID、输入/来源预检故障注入通过。
- [x] 等待文案改为 1-4 分钟并说明外部依赖。
- [x] release precheck、bundle/evidence scan、rollback 和只读 smoke checklist 建立。
- [x] typecheck、78/78、build、diff、双端 UI、console 通过。
- [x] 真实 provider 调用 0；未 commit、push、部署或写生产。

当前等级：C2。本文件不是 C3/C4 完成证明。

强制停止点：等待用户分别确认 commit/push、部署、一次生产 POST/报告写入与四模型成本，以及腾讯/火山后台额度有效截止时间。
