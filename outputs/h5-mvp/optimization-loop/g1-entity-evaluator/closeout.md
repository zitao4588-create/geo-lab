# G1 最终收口

完成等级：C2。

- 建立安全实体别名：完整名、合理简称和营销名可识别，通用品类词不能绑定实体。
- 建立六层人工 ground truth：品牌、营销名、产品/服务、主型号、城市、门店。
- 主型号解析从松下专用 `ES-*` 泛化到通用字母数字型号；错误主型号不能被相关型号掩盖。
- 新增采样前来源事实门：preflight 与正式提交都会先 PageAudit；型号冲突返回确认状态，provider 调用和限额消耗均为 0。
- 提交来源可信度与站点基建完整度完成数据和用户展示分拆；四种报告表面一致。
- typecheck、59/59 测试、build、diff check 通过。
- 两种关键状态 × 两个 viewport 通过真实浏览器 QA；0 overflow、0 console error、0 warning。
- 真实 provider 调用 0；无 commit、push、部署或生产修改。

下一项：G2“AI曝光体检官方内容与结构化证据”。
