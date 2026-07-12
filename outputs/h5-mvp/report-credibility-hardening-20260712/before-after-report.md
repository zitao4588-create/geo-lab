# 报告可信度加固前后对比

## 修复前

- 品牌字符串复述被当作 AI 可见度。
- 冰箱小雷达 50% 字符串提及被包装成较好的整体认知，但人工复核正确实体识别和无品牌词推荐均接近零。
- 未提交 URL 时摘要显示页面审计 0/100，导出页头却显示基建维度 20/100。
- 实体剃须刀收到微信、隐私、数据上传、拍照、支付和小程序入口模板建议。
- 模型之间的型号冲突未单独呈现。

## 修复后

- 字符串出现、正确实体识别、无品牌词推荐、错误认知和模型一致度分开呈现。
- 低证据输入在模型调用和限额消耗前被预检拦截。
- 没有可审计 URL 时统一显示“未检测”，且暂停总分。
- 实体商品使用型号、规格、安全、售后、耗材和正规渠道问题模板。
- H5、Markdown、HTML 和 evidence package 共享同一可信度结构。

## 固定样本

- 松下：{"reportId":"diag_credibility_panasonic","scoreStatus":"available","confidence":"high","infrastructureAudit":100,"stringMentionRate":0.35,"correctEntityRecognitionRate":0.4,"naturalRecommendationRate":0,"misrecognitionRate":0.4,"providerAgreementRate":0.5,"modelConflictCount":7}
- 冰箱小雷达：{"reportId":"diag_credibility_fridge","scoreStatus":"available","confidence":"high","infrastructureAudit":100,"stringMentionRate":0.5,"correctEntityRecognitionRate":0,"naturalRecommendationRate":0,"misrecognitionRate":0.75,"providerAgreementRate":0.75,"modelConflictCount":6}
- 虚构品牌预检：insufficient_evidence，补充具体产品类型、核心功能或型号。；补充更具体的使用人群或决策场景。；把行业细化到具体品类，例如“电动剃须刀”而不是“清洁工具”。；粘贴官网、官方产品页、小程序介绍页或公开账号入口。
