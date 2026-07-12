# G2 基线

记录时间：2026-07-12

修改前的本地内容存在四类可复现缺口：

1. 首页把产品写成“30 秒看清 AI 曝光风险”，没有统一说明目标用户、GEO 类别和证据诊断边界。
2. 缺少 `/features/`、`/faq/`、`/geo-case/` 和 `llms.txt`；首页与 FAQ 也没有 WebApplication / FAQPage 结构化数据。
3. `sitemap.xml` 只覆盖首页、介绍、隐私和条款。
4. PageAudit 使用不存在的 `/privacy/` 路径，事实词典还硬编码“冰箱小雷达”和冰箱功能词。

失败契约结果：4 组测试 0/4 通过。失败原因分别为统一定义缺失、FAQ 文件缺失、sitemap 路由缺失和 features 文件缺失。

真实 provider 调用：0。
