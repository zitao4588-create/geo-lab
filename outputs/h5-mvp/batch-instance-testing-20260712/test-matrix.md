# 20 实例测试矩阵

| ID | 场景 | 业务类型 | 来源状态 | 预期 | 实际 | 模型调用 | 消耗限额 | 展示总分 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | 实体商品资料和官方型号页完整 | physical_product | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| P02 | 输入型号与官方来源冲突 | physical_product | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| P03 | 只有品牌和宽泛品类 | physical_product | missing | needs_confirmation | needs_confirmation | 否 | 否 | 否 | 通过 |
| P04 | 虚构品牌且无可靠来源 | physical_product | missing | insufficient_evidence | insufficient_evidence | 否 | 否 | 否 | 通过 |
| S01 | 软件资料和官网完整 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| S02 | 冰箱小雷达复用已保存证据 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| S03 | 名称通用且存在同名实体 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| S04 | 小程序被误认为硬件 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| L01 | 本地服务城市范围和门店入口完整 | local_service | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| L02 | 本地服务缺少城市和半径 | local_service | candidate | needs_confirmation | needs_confirmation | 否 | 否 | 否 | 通过 |
| L03 | 具体门店仅有全国品牌首页 | local_service | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| L04 | 服务承诺缺少来源证明 | local_service | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| E01 | 介绍包含指令注入 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| E02 | URL 与实体无关 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| E03 | 用户事实与官方来源冲突 | physical_product | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| E04 | 大量重复广告和无关文本 | generic_or_unknown | missing | needs_confirmation | needs_confirmation | 否 | 否 | 否 | 通过 |
| R01 | 相同请求重复提交 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| R02 | 预检失败后补齐再提交 | software_or_miniprogram | missing | insufficient_evidence | insufficient_evidence | 否 | 否 | 否 | 通过 |
| R03 | 部分模型失败 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |
| R04 | 四种报告表面数据一致 | software_or_miniprogram | candidate | ready | ready | 否 | 否 | 否 | 通过 |

阶段 A 只验证 validation / preflight；来源状态 candidate 不等于 verified。

## 阶段 B

| ID | 执行方式 | 报告 ID | 成功/总样本 | 四模型完整 | 置信度 | 展示总分 | 结果 |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| P01 | 真实调用 | diag_mrh248zn_0j2lkh | 10/40 | 否 | 低 | 否 | 保护通过，运行态失败 |
| P02 | 真实调用 | diag_mrh24sb1_iiujt2 | 10/40 | 否 | 低 | 否 | 保护通过，冲突未能验证 |
| S01 | 真实调用 | diag_mrh25adf_p7j0ss | 10/40 | 否 | 低 | 否 | 保护通过，运行态失败 |
| S02 | 复用 2026-07-11 证据 | diag_mrfzt02t_me73v1 | 40/40 | 是 | 见原报告 | 见原报告 | 通过，无新调用 |
| L01 | 真实调用 | diag_mrh25xlq_8hqjbb | 10/40 | 否 | 低 | 否 | 保护通过，来源假阴性 |
| L03 | 真实调用 | diag_mrh26ke2_kvp5su | 10/40 | 否 | 低 | 否 | 来源边界正确，运行态失败 |
