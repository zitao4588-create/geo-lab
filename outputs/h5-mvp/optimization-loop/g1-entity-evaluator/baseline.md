# G1 基线

时间：2026-07-12

## Git 与范围

- 分支：`codex/source-recognition-hardening`
- 本 Loop 新增 `docs/` 控制文件；任务开始前已有的海报、AnySearch 输出和第一次 Stage B 重建重复目录保持未触碰。
- 权限：L1/L2；无 commit、push、部署、生产写入、真实 provider 调用或云配置修改。

## 自动化基线

- `npm run typecheck`：通过。
- `npm test` 首次沙箱内运行：40/47，通过的确定性测试正常；7 个集成测试因 `listen EPERM 127.0.0.1` 失败。
- 错误分类：执行环境权限，不是代码回归。
- 按沙箱升级规则在沙箱外只重跑 `npm test`：47/47 通过。
- 真实模型调用：0。

## 下一检查点

建立 G1 人工标注 benchmark 和失败回归，覆盖合理别名、完整字符串误判、相关产品冒充主型号、采样前型号冲突门和来源/基建语义拆分。
