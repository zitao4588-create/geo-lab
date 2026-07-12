# G1 失败与修复记录

## 预期失败回归

1. 新 benchmark 首轮无法导入 `assessDiagnosisSource`：证明采样前来源冲突评估器尚不存在。
2. PageAudit 的 `submittedSourceScore` / `siteInfrastructureScore` 首轮为 `undefined`：证明来源可信度与站点基建尚未拆分。
3. A06 首轮为 `not_verifiable`：正确主型号但未复述品牌时，类型锚点过严；改为官方主型号声明可作为强实体锚点。

## 全量回归中发现并修复

1. 旧版 `0.4` fixture 没有 `sourceRelation/scopeRelation/submitted` 字段，统一的严格 helper 把旧已验证页降级。修复为：缺省字段兼容旧报告；新 PageAudit 明确写入关系字段后仍严格拦截 unrelated/partial/mismatched。
2. 旧导出测试仍断言单一“公开页面审计”。更新为同时断言提交来源可信度与站点基建完整度，不保留容易误解的旧用户文案。
3. 型号解析只支持 `ES-*`。泛化为含字母和数字的 3-20 位型号标识，并增加 S9000、X-PRO3 回归。

## 环境差异

- 沙箱内首次全量集成测试的 7 个失败均为 `listen EPERM 127.0.0.1`。
- 按沙箱规则在允许本地监听的环境重跑后通过；没有把环境权限问题记录成产品回归。

## 未修复但不属于 G1

- JavaScript 动态页面渲染、SSRF/重定向/DNS rebinding 和证据时效属于 G3。
- 生产真实诊断与额度保护属于 G4。
