# 阶段 B 真实多模型测试报告

- 执行时间：2026-07-12T00:29:45.974Z 至 2026-07-12T00:32:03.779Z
- 授权：用户于 2026-07-12 明确确认火山方舟后台免费边界并授权全量执行阶段 B。
- 真实新报告：5
- 复用报告：1（S02 冰箱小雷达，未新增调用）
- 唯一测试问题：50
- provider × prompt 槽位：200
- 可推断实际 HTTP 尝试：250（含 DeepSeek fallback）
- 成功/失败样本：50/150
- 完整四模型报告：0/5

## 实例结果

| ID | 报告 ID | 耗时 | 成功/槽位 | PageAudit | 置信度 | 用户总分 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| P01 | diag_mrh248zn_0j2lkh | 29.4s | 10/40 | 14 | low | 暂停展示 |
| P02 | diag_mrh24sb1_iiujt2 | 25.0s | 10/40 | 14 | low | 暂停展示 |
| S01 | diag_mrh25adf_p7j0ss | 23.4s | 10/40 | 66 | low | 暂停展示 |
| L01 | diag_mrh25xlq_8hqjbb | 30.1s | 10/40 | 41 | low | 暂停展示 |
| L03 | diag_mrh26ke2_kvp5su | 29.5s | 10/40 | 41 | low | 暂停展示 |

## Provider 结果

| Provider | 最终模型 | 成功/槽位 | 失败 | fallback 问题数 |
| --- | --- | ---: | ---: | ---: |
| deepseek | deepseek-v4-pro | 0/50 | 50 | 50 |
| hy3 | hy3 | 0/50 | 50 | 0 |
| qwen | qwen3.7-plus | 0/50 | 50 | 0 |
| doubao | doubao-seed-2-0-lite-260215 | 50/50 | 0 | 0 |

## 已确认失败原因

- 百炼 DeepSeek：本机出口 IP 不在 API Key 白名单；主模型失败后按既有规则 fallback 到 deepseek-v4-flash，仍返回 403。
- 百炼 Qwen：本机出口 IP 不在 API Key 白名单，50/50 失败。
- 腾讯 TokenHub Hy3：后台明确返回 Source IP 不在 API Key allowlist，50/50 失败。
- 火山方舟 Doubao Seed 2.0 Lite：50/50 成功，无 fallback、无余额或计费错误。
- 本轮没有发现 billing、balance、overdue 或付费信号。

## 可信度合同表现

- 5/5 新报告都把覆盖率缺失写入“仍待核验”，置信度降为 low。
- 5/5 新报告都暂停展示用户总分，没有把单一 provider 结果包装成完整四模型结论。
- 页面和导出保留成功样本，不用模拟结果填补三家失败。
- P01/P02 的松下官方页和 L01/L03 的海底捞入口未被 PageAudit 充分核验，属于来源抓取/匹配的真实 P1，不是可以忽略的噪声。

## 结论

阶段 B 的六个指定实例都已覆盖，但本轮真实四模型链路 **不通过**：5 个新实例只有火山方舟成功，provider 槽位覆盖率为 25%。可信度保护本身通过，没有出现 P0 级误出分或伪造样本；当前阻塞是 API Key IP 白名单和官方页面 PageAudit 识别率。
