# AnySearch H5 接入前 3 查询 Benchmark

日期：2026-07-07T06:49:40.311Z

运行方式：临时 AnySearch Skill v2.1.0，Node CLI，匿名访问，不使用 API key。

## 测试结论

不建议现在直接接入 H5 生产诊断链路。

AnySearch 在“竞品/行业候选来源发现”和“已知 URL 的部分正文抽取”上有价值，但对新站、低收录站或站点限定查询不稳定；网页抽取也受页面类型影响。它可以进入 Agent 侧或后端受控实验的候选来源发现层，不能作为最终证据源或线上报告的唯一搜索能力。

## 结果对比

| 测试对象 | 查询 | 结果数 | 目标站命中 | 抽取正文 | 评估 | Top URLs |
|---|---:|---:|---:|---:|---:|---|
| AI曝光体检自有 H5 | AI曝光体检 exposure.playgamelab.cn GEO | 5 | 否 | 弱/失败 | weak_for_target_discovery | https://www.aipogeo.cn/AI%E8%83%BD%E8%A7%81%E5%BA%A6%E6%A3%80%E6%B5%8B.html<br>https://dn-solutions.com/cn/solution/solutionDetail.do?soluSeq=<br>https://developer.volcengine.com/articles/7657771015758839844 |
| 冰箱小雷达案例站 | 冰箱小雷达 fridge.playgamelab.cn 冰箱食材库存管理小程序 | 5 | 否 | 可用 | search_miss_extract_ok | https://github.com/stonehard0208/IceBox-A-Wechat-mini-program-based-on-CloudBase<br>https://apps.apple.com/us/app/%E9%A3%9F%E5%85%89%E5%86%B0%E7%AE%B1-%E5%B8%AE%E5%8A%A9%E9%A3%9F%E6%9D%90%E6%94%B6%E7%BA%B3%E4%B8%B4%E6%9C%9F%E7%AE%A1%E7%90%86%E7%9A%84%E5%86%B0%E7%AE%B1%E7%AE%A1%E5%AE%B6/id6742053950<br>https://www.reddit.com/r/Cooking/comments/1hq5yqu/inventory_app_for_managing_pantry_fridge/?tl=zh-hans |
| GEO 竞品/市场发现 | GEO 品牌体检 工具 多平台 DeepSeek Kimi ChatGPT | 5 | 不适用 | 可用 | useful_for_discovery | https://www.aipogeo.cn/AI%E8%83%BD%E8%A7%81%E5%BA%A6%E6%A3%80%E6%B5%8B.html<br>https://adg.csdn.net/6a46043310ee7a33f285a875.html<br>https://zhuanlan.zhihu.com/p/2049856851165156059 |

## 分析

- 自有 H5 查询没有稳定命中 `exposure.playgamelab.cn`，说明它不能可靠证明新站/自有站是否被搜索收录。
- 冰箱小雷达案例站的 search 未稳定命中目标站，但 direct extract 对 `fridge.playgamelab.cn` 可抽出正文，适合验证已知页面事实。
- GEO 市场查询能发现相关竞品/工具页面，适合补充竞品池和素材来源池。
- Search snippet 可以作为线索，不应直接进入最终报告证据；最终证据仍要二次抓取、保存 URL、保存抽取时间和原始响应。

## 接入判断

当前结论：暂不接入 H5 线上 `/api/diagnoses` 主流程。

可接受的下一步是做一个后端 adapter spike，并默认关闭：

1. 只在本地或受控测试开启。
2. 使用服务器端 `ANYSEARCH_API_KEY`，不暴露给前端。
3. AnySearch 只产出候选 URL 和候选竞品，不直接产出最终判断。
4. 每个候选 URL 必须经过现有 crawler/page-audit 二次验证后，才进入 evidence package。
5. 再扩到 10 个固定查询，命中率、抽取成功率、耗时和错误率达标后再考虑上线。

## 原始文件

- `self-h5.search.md`
- `self-h5.extract.md`
- `self-h5.meta.json`
- `fridge-case.search.md`
- `fridge-case.extract.md`
- `fridge-case.meta.json`
- `geo-market.search.md`
- `geo-market.extract.md`
- `geo-market.meta.json`

- `summary.json`
