# G2 完成审计

## 专属验收

- [x] 一句话定义、类别、目标用户、流程、输入输出与能力边界一致。
- [x] 首页、介绍、FAQ、隐私与 `llms.txt` 使用同一产品定义。
- [x] 明确排除医学体检、身体/影像检测、隐私泄露扫描、广告投放曝光统计。
- [x] WebApplication 与 FAQPage JSON-LD 本地解析通过。
- [x] canonical、robots、sitemap 与机器可读入口通过契约检查。
- [x] PageAudit：提交来源 100/100，站点基建 100/100，8/8 target 为 ok。
- [x] 旧“效果案例”改为可追溯但不外推的证据边界示例。
- [x] 双端浏览器与人工截图复核通过。

## 通用验收

- [x] `npm run typecheck`
- [x] `npm test`：63/63
- [x] `npm run build`
- [x] `git diff --check`
- [x] 真实 provider 调用：0
- [x] 未触发 commit、push、部署、生产写入、付费调用或云账号修改

完成等级：C2（本地实现并完整验证，尚未提交或部署）。
