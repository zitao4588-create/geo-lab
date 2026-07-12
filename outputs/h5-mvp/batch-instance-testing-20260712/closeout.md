# 批量实例测试最终收口

生成时间：2026-07-11T23:42:24.565Z

完成等级：C2（阶段 A、本地自动化、视觉验证和阶段 B 真实运行已完成；多 provider 运行态未通过，未部署）

## 已验证

- 20/20 实例都有预期和实际预检结果、调用/额度/总分状态和直接证据映射。
- 阶段 A 真实模型调用与额度消耗均为 0；本地模拟只使用 fixture / fake provider。
- 两个 P0、两个阶段 A P1 已由失败测试复现并最小修复；阶段 B 另保留两个运行态 P1。
- H5 使用报告对象的 stages.credibility；Markdown、HTML 和 evidence package 的同源字段有自动化断言。
- 五种关键状态在 390×844 与 1440×1000 共 10 项视觉检查通过，无横向溢出或 console error/warning。
- 最终验证：npm test 40/40、npm run typecheck、npm run build、git diff --check 均通过。

## 阶段 B

- P01、P02、S01、L01、L03 共生成 5 份新真实报告；S02 只复用 2026-07-11 四模型证据，没有重新采样。
- 50 个唯一问题形成 200 个 provider × prompt 槽位；50 成功、150 失败。
- 火山方舟 50/50 成功；百炼 DeepSeek、百炼 Qwen、腾讯 Hy3 均因 API Key IP 白名单 403 而 0/50。
- DeepSeek 主模型失败后对 50 个问题触发 flash fallback，仍被 403 拒绝；未发生豆包 fallback。
- 5/5 新报告均为低置信度并暂停展示总分；没有 billing、余额或欠费信号。
- 阶段 B 的可信度保护通过，但四模型完整率 0/5，因此多 provider 运行态不通过。
- 真实视觉 QA 发现并修复“主封面暂不评分、桌面预览和摘要仍泄露内部总分”的 P0；刷新后的 H5、Markdown、HTML 和 evidence package 展示语义一致。
- TokenHub 403 中的来源 IP 已统一替换为 `[redacted_ip]`，没有把 API Key、Cookie、Token、账号 ID 或公网 IP 留在输出中。

## 未执行

- 未 commit、push、部署或修改生产 runtime。
- 未做生产 POST，未新增 provider。

## 剩余风险

- 候选 URL 与实体相关性仍需 PageAudit/人工 ground truth。
- 全国品牌首页不能证明具体门店。
- 通用名称同名消歧尚无独立来源发现 provider。
- 当前出口 IP 未加入百炼和 TokenHub API Key 白名单。
- 松下与海底捞官方入口存在 PageAudit 假阴性，正常实例也会被降为证据不足。
