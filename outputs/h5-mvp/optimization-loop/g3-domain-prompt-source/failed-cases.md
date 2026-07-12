# G3 失败与修复记录

1. 首个测试因 `validateAuditUrl` 不存在而失败：随后实现受控抓取与 URL/DNS 校验。
2. 第一轮 G3 专属测试 4/7：软件缺少“适用”字样；跳转用例把站点基建请求误算为私网请求；动态 fixture 的城市字段被测试 helper 覆盖。分别修正文案、断言边界和 fixture 合并顺序后 7/7。
3. 旧 PageAudit 回归第一轮 10/16：mock fetch 仍触发真实 DNS。改为仅当使用原生 fetch 时启用默认 DNS；注入 fetch 必须显式注入 resolver，旧受控 mock 使用固定公网 resolver。随后 16/16。
4. IPv4-mapped IPv6 用例首次漏过：Node 将地址规范化为十六进制形式。改为 fail-close 拒绝 `::ffff:` 网段后通过。

没有删除、跳过或弱化旧测试；最终全量 73/73。
