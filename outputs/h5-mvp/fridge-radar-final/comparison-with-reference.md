# 冰箱小雷达 H5 最终报告 vs 旧参考案例对比

更新：`fridge.playgamelab.cn` 上线后，本文末尾 1-6 条优化方向已在新版 H5 中完成并复测。复测结果见 `outputs/h5-mvp/fridge-radar-post-launch/comparison-after-launch.md`；上线后总分 68/100，公开页面审计 100/100，DeepSeek 同一 20 条问题品牌提及率仍为 40%。

对比对象：

- 新 H5 最终报告：`outputs/h5-mvp/fridge-radar-final/final-report.md`
- 旧参考案例：`sources/local-artifacts/fridge-radar/冰箱小雷达冰箱食材库存管理小程序-diag-report.json`

## 核心差异

| 项目 | 新 H5 最终报告 | 旧参考案例 |
| --- | --- | --- |
| 总分 | 61/100，一般 | 41/100，较差 |
| 采样口径 | DeepSeek 官方 API 本次真实采样 20/20 | 8 平台结构完整，但多处标注为虚拟/模拟 |
| 品牌提及 | 8/20，提及率 40% | 声称 8 平台综合提及率 9.2% |
| 报告结构 | 单一 GEO 分析成果得分，含证据边界、评分拆解、采样摘录、基建、竞品、风险、建议、路线图 | 9 模块更完整，含用户画像、基建、竞品、AI 搜索、GEO 效果、舆情、AIVO、建议 |
| 证据可信度 | 明确保存 `runtime/evidence/<id>/samples.json` 和 source-map | 结构像正式报告，但 search-cache/虚拟来源不足以支撑真实结论 |
| 表达边界 | 不承诺排名提升，区分 sampled_ai_answer / model_inference / suggested_supplement | 有 6 个月提升到 63 分等预测，证据边界较弱 |

## 新报告优点

1. 真实采样替代了模拟结论。  
   本次报告的 40% 提及率来自 DeepSeek API 的 20 条问答，不再把虚拟平台结果当作事实。

2. 证据链更容易审计。  
   每份报告都有 `samples.json`、`source-map.json`、`source-map.md`，可以回看具体 prompt、回答和失败原因。

3. 产品形态更适合 H5 转化。  
   用户只看到一个 GEO 成果得分，不再出现“快速初筛/双分数”造成理解负担。

4. 风险判断更诚实。  
   报告把“品牌公开资料不足”“隐私/主体/功能边界误读”直接写成主要问题，而不是只给营销式优化建议。

## 新报告不足

1. 目前只采样 DeepSeek。  
   不能代表豆包、Kimi、元宝、通义、文心等平台的可见度。

2. 公开基建还没有真实抓取页面内容。  
   当前只根据用户提交入口判断“计划/本地/线上”状态，还没有自动抓取 `fridge.playgamelab.cn`、隐私页、FAQ、llms.txt、sitemap 等页面。

3. 竞品分析还偏轻。  
   只统计本次答案是否提及竞品，没有形成旧参考案例那样的竞品画像、优势/弱点、威胁等级和市场位置。

4. 报告导出形态还不够交付化。  
   H5 页面可读，但还没有正式 HTML/PDF/Word 报告包和证据附件下载。

## 旧参考案例优点

1. 模块完整，适合作为报告目录参考。  
   `OVERVIEW`、`AIVO_SCORE`、`USER_PROFILE`、`AI_SEARCH`、`INFRA_EVAL`、`COMPETITOR`、`GEO_EFFECT`、`SENTIMENT`、`SUGGESTION` 这套结构仍然值得保留。

2. 行动建议更细。  
   旧报告把品牌页、隐私页、内容池、CSDN/知乎引用、季度复测拆得更像顾问交付。

3. 冰箱小雷达业务理解更深入。  
   对 5 分区、开饭雷达、本地算法、个人主体边界的描述比当前自动报告更具体。

## 旧参考案例问题

1. 证据边界不足。  
   多处平台结果写着“虚拟”，不能作为真实 AI 可见度或排名证据。

2. 指标容易显得过满。  
   8 平台综合提及率、竞品市场份额、6 个月提升预测等数字，如果没有采样原文和方法说明，商业交付风险较高。

3. 可复现性弱。  
   缺少完整原始采样答案、时间、失败记录和 source-map，后续复测难以对齐。

## 下一步优化方向

1. 先把 `fridge.playgamelab.cn` 真正上线，再用 H5 复测。  
   当前 H5 已把“本地已准备”降级为未验证线索；站点上线后，应重新提交线上 URL，让基建项从 `warn` 变成真实 `ok`。

2. 增加 URL 抓取与页面审计。  
   后端增加轻量抓取：检查首页、隐私页、FAQ、features、geo-case、robots、sitemap、llms.txt 是否 200、title 是否匹配、是否包含目标事实。

3. 扩展多平台采样。  
   DeepSeek 作为第一采样源保留；第二步增加豆包/Kimi/元宝/通义的可插拔 adapter，把平台字段写入 evidence。

4. 强化竞品模块。  
   对每个竞品增加：答案提及次数、提及问题、差异点、模型误读点、应该补的对比内容。

5. 增加正式报告导出。  
   输出 HTML/PDF/Markdown 三件套，并把 `samples.json` 和 `source-map.md` 打包成证据附件，方便给客户交付。

6. 为冰箱小雷达做优化前后复测。  
   以上线前 61 分、40% DeepSeek 提及率作为 baseline；品牌站上线并补内容后，用同一 20 条 prompt 复测，观察是否真的提升。
