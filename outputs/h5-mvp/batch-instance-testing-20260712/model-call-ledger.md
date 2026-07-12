# 模型调用台账

生成时间：2026-07-12T00:48:27.575Z

## 阶段 A

- 真实模型调用：0
- 付费调用：0
- fallback：0
- 所有 20 个实例只运行确定性 validation / preflight。

## 阶段 B

- 用户成本授权：用户于 2026-07-12 明确确认火山方舟后台免费边界并授权全量执行阶段 B。
- 新增真实报告：5
- S02 复用报告：1，新增调用 0
- 唯一问题：50
- provider × prompt 槽位：200
- 可推断 HTTP 尝试：250
- 成功样本：50
- 失败样本：150
- DeepSeek fallback 问题：50
- billing/余额/欠费信号：0

| Provider | 模型 | 问题槽位 | 成功 | 失败 | fallback 问题 |
| --- | --- | ---: | ---: | ---: | ---: |
| deepseek | deepseek-v4-pro | 50 | 0 | 50 | 50 |
| hy3 | hy3 | 50 | 0 | 50 | 0 |
| qwen | qwen3.7-plus | 50 | 0 | 50 | 0 |
| doubao | doubao-seed-2-0-lite-260215 | 50 | 50 | 0 | 0 |

失败原因：百炼 DeepSeek/Qwen 与腾讯 Hy3 均被 API Key IP 白名单以 403 拒绝；火山方舟 50/50 成功。权限错误不再重试，未修改任何云端白名单设置。
