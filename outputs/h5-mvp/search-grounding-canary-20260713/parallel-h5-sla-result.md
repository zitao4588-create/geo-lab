# H5 四模型 + 火山联网并行 SLA 实测

- 执行时间：2026-07-13
- 报告 ID：`diag_mrjeje38_ey9xig`
- 测试对象：flomo 浮墨笔记
- 执行环境：隔离本地 runtime，未写入生产数据，未部署
- 整单服务端耗时：27,535 ms
- 客户端观测耗时：27.55 秒
- SLA：30 秒
- 报告结构：已在 SLA 内生成并落盘

## 模型采样

| Provider | 模型 | 成功 | 失败 | 结果 |
| --- | --- | ---: | ---: | --- |
| DeepSeek | deepseek-v4-pro | 9 | 1 | partial |
| Hy3 | hy3 | 10 | 0 | sampled |
| Qwen | qwen3.7-plus | 10 | 0 | sampled |
| 豆包 | doubao-seed-2-0-lite-260215 | 8 | 2 | partial |
| 合计 | 4 个模型 | 37 | 3 | 92.5% 成功 |

失败项为 DeepSeek P020、豆包 P017、豆包 P020，均被共享截止时间中止；没有 fallback，也没有伪造或补写回答。

## 联网搜索

- Provider：火山方舟联网内容插件
- 状态：success
- 耗时：17,046 ms
- 结果数：5
- Usage：4,440 input tokens、614 output tokens、5,054 total tokens
- 结果中包含 flomo 官方帮助页，同时包含第三方软件下载站、企查查和工具导航站。
- 搜索结果仅作为候选公开来源，不参与事实评分，不能解释为消费端搜索曝光或稳定排名。

## 证据

- 完整报告：`parallel-h5-sla-runtime-20260713/diagnoses/diag_mrjeje38_ey9xig.json`
- 模型原始答案：`parallel-h5-sla-runtime-20260713/evidence/diag_mrjeje38_ey9xig/samples.json`
- 联网原始响应：`parallel-h5-sla-runtime-20260713/evidence/diag_mrjeje38_ey9xig/public-web-search.json`
- 运行耗时和 provider 汇总：`parallel-h5-sla-runtime-20260713/operations/latest.json`

## 判定

单次整链路在 30 秒内返回完整报告结构，说明并行方案可行；但模型答案只有 37/40 成功，因此不能表述为“30 秒内四模型全部完整成功”。当前证据也只有 1 次整链路样本，不能声称 P95 已验证。
