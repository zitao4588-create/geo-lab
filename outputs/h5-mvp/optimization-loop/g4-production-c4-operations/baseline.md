# G4 基线

记录时间：2026-07-12

修改前：

- health 把 API key 存在直接等同 `ready/samplingReady`，没有成本门或最近真实成功语义。
- 腾讯与火山在计费边界未知时仍可自动参与采样。
- 每 IP/全局限流只在进程内存，重启后清零。
- `diagnosis_generated` 只记录总成功/失败、采样和总时长，没有 provider 成功率、失败类型、fallback、P50/P95、最慢问题或 PageAudit 时长。
- 前端写“通常 20–60 秒”，与既有运行证据中的分钟级尾延迟不一致。
- runbook 有人工命令，但没有可执行的 release precheck、bundle/evidence secret scan 和独立 checklist。

首个 G4 测试因 operations 模块不存在而失败，固定了实现前红灯基线。
