# 来源识别强化验收矩阵

| ID | 场景 | 预期边界 | 预期结果 | 状态 |
| --- | --- | --- | --- | --- |
| P01 | 具体官方产品页 | entity_matched + matched | 可评分，官方型号 ES-LM55 | 通过 |
| P02 | 用户型号与官方页冲突 | entity_matched + matched | 可评分，并显式展示 ES-LV9C / ES-LM55 冲突 | 通过 |
| L01 | 官方门店搜索入口 | entity_matched + partial | 暂停评分，缺少西安具体门店证明 | 通过 |
| L03 | 全国品牌首页 | entity_matched + mismatched | 暂停评分，品牌首页不能证明具体门店 | 通过 |
| E02 | 无关 URL | unrelated + mismatched | 暂停评分，不支持实体识别 | 通过 |
| E03 | 用户事实与官方来源冲突 | entity_matched + matched | 显式记录型号事实冲突 | 通过 |
| L04 | 未证明价格/效果/安全承诺 | 无有效范围证据 | 暂停评分，承诺仅保留在待核验事实 | 通过 |
