# G4 故障注入与恢复

- 成本门未知/过期：腾讯与火山已配置但 `samplingAllowed=false`，0 provider 请求。
- DeepSeek 主模型额度错误：受控测试切到 Flash fallback 后成功。
- Doubao 主模型额度错误：受控测试切到下一配置模型后成功。
- provider 部分失败：保留成功样本、降低置信度、必要时暂停总分。
- 客户端丢响应：同 `clientRequestId` 恢复同一落盘报告，不重复采样。
- 进程重启：同 ID 继续持久恢复；不同 ID 仍受此前小时限流，模型调用不增加。
- source fact conflict / 输入预检失败：在限额和模型采样前停止。

所有故障注入只连接本机 fake provider；真实 provider 调用 0。
