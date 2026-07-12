# PageAudit 修复前后对比

| ID | 修复前 | 修复后提交入口 | 解释 |
| --- | --- | --- | --- |
| P01 | 丢弃产品路径，只审计松下首页；0 个通过，14/100 | entity_matched / matched / ok，19/100 | 聚合分仍受补充入口缺失影响，但具体 ES-LM55 产品页不再是假阴性 |
| P02 | 与 P01 相同，无法建立官方主型号 | entity_matched / matched / ok，19/100 | 官方主型号 ES-LM55 与用户填写 ES-LV9C 的冲突可被显式记录 |
| L01 | 丢弃 /serve/storeSearch，只审计全国首页 | entity_matched / partial / warn，41/100 | 官方门店搜索入口被识别，但页面不能证明西安具体门店 |
| L03 | 全国首页只显示一般 warn | entity_matched / mismatched / warn，41/100 | 明确记录品牌匹配但业务层级不匹配 |

关键改变不是抬高聚合分，而是把页面可访问、实体关系和业务范围拆开，避免 HTTP 200 或同域名直接变成实体事实。
