# 运行观测合同

`runtime/operations/latest.json` 只保存：

- report ID 和记录时间；
- PageAudit、采样、总耗时；
- provider、实际模型集合、prompt 数、成功/失败数与成功率；
- fallback 数、失败类型计数、P50/P95、最慢 Prompt ID、最近成功时间。

明确不保存：表单内容、Prompt 全文、回答、联系方式、API key、token、Cookie 或原始 IP。

`/api/health` 将配置存在、成本门允许和最近真实成功分开：`configured` / `samplingAllowed` / `costGuard` / `lastRealSuccessAt`。没有 operations 证据时不会把 ready 写成最近成功。
