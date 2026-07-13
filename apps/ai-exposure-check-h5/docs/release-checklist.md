# AI曝光体检 Release / Rollback / Smoke Checklist

## 0. 权限门

在执行前逐项确认：commit/push、部署、生产诊断 POST、生产报告写入与真实模型成本。没有对应确认，只能做本地 L2 与线上只读 GET/HEAD。

## 1. 本地候选

- `npm run typecheck`
- `npm test`
- `npm run release:precheck`
- `git diff --check`
- 扫描本次证据：`node scripts/scan-release-artifacts.mjs dist/client <evidence-dir>`
- 确认没有 `.env`、runtime、API key、token、Cookie、原始 IP 或真实表单进入 release/bundle/evidence。

## 2. 成本与 provider 巡检

- 百炼：确认目标模型范围、白名单、FreeTierOnly/用完即停仍有效。
- 腾讯 TokenHub、火山方舟：检查授权、用量、费用和错误分类；Hy3、Doubao 不再使用人工到期闸门。
- 出现异常费用、额度、授权或质量信号时，把对应 `HY3_ENABLED` / `DOUBAO_ENABLED` 设为 `false` 并重启服务。
- `/api/health` 必须分别核对 `configured`、`enabled`、`samplingAllowed` 和最近成功时间。

## 3. 部署前快照

- 记录当前 commit、release 目录、`current` symlink、systemd 状态和只读 health。
- 备份当前 `.env`，保持 mode 600；不要在输出中打印值。
- 保留上一 release，不批量删除。

## 4. 只读 smoke（默认）

- 首页、features、FAQ、privacy、terms、robots、sitemap、llms：GET/HEAD 200 与正确 content-type。
- `/api/health`：配置、启用开关、采样资格和最近真实成功四类状态不混淆。
- 复用既有报告检查查询、evidence、Markdown、HTML、evidence package。
- 检查 systemd active、current symlink、服务日志无 secret/表单全文。
- 移动与桌面无溢出、console error。

## 5. 一次生产诊断（仅明确授权后）

- 使用无隐私的固定 payload 和稳定 `clientRequestId`。
- 只生成一份：首次请求、同 ID in-flight/持久恢复、查询和导出；不得换 ID 重采样。
- 记录四 provider 实际成功/失败、fallback、P50/P95、最慢 Prompt ID、PageAudit/采样/总耗时。
- 出现 billing/quota/authorization 信号时立即停止并按 provider 独立停用，不伪造 C4。

## 6. 回滚

- 把 `current` 原子切回上一 release。
- 重启 `ai-exposure-check-h5.service`，确认 active。
- 只读重复第 4 节 smoke。
- 不删除失败 release；记录失败证据、尝试和恢复点。
