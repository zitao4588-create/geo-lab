# 单实例限流持久化

- 文件：`runtime/rate-limits.json`，原子临时文件 + rename 写入，mode 600。
- 每 IP 小时限制和全局 UTC 日限制均持久化。
- IP 使用固定 salt 的 SHA-256 标识；测试确认文件不含原始 IP。
- 单实例内以 Promise queue 串行消费，避免并发请求同时越过上限。
- 重启测试：首次请求成功并占用额度；重启后同 ID 可恢复，不同 ID 返回 429，provider 调用数不增加。

边界：这不是多实例协调系统；若未来水平扩容必须另开 Goal 设计共享限流。
