# G4 阶段性 Closeout

本地生产候选已达到 C2，尚未 commit/push/deploy，尚未生成生产报告，因此不是 C3/C4。

继续前必须获得：

1. L3/L4：允许把当前 G1-G4 变更 commit 并 push 到指定分支。
2. L4：允许按现有 release/symlink/systemd 流程部署 H5 target。
3. L4 + 成本/生产数据：允许一次生产诊断 POST，只生成一份报告，使用稳定 request ID，验证同 ID 恢复、查询和三种导出。
4. 人工后台证据：百炼 FreeTierOnly/模型范围/白名单；腾讯权益与费用中心；火山免费推理额度/奖励包与后付费风险，并给腾讯/火山成本门明确的未来截止时间。

未获得任一项时保持 waiting_for_user；不得把 C2 写成最终交付。
