# flomo 公开页面与本地实网边界

## 公开页面已确认

2026-07-15 只读打开公开页面确认：

- `https://flomoapp.com/` 首页直接链接 `help.flomoapp.com` 的 flomo 101、下载、会员、功能详情、隐私协议和常见用法。
- `https://help.flomoapp.com/` 明确显示“flomo 浮墨笔记”“常见问题”“使用指南”和“隐私政策”。
- `https://help.flomoapp.com/privacy.html` 可访问，明确适用于 flomo 浮墨笔记并包含隐私、个人信息、数据收集使用、存储和保护说明。

因此隔离回归使用的 URL 结构与当前公开页面一致，不是虚构路径。

## 当前机器未通过的实网步骤

本地编译后的 `auditSubmittedPages` 直接访问 flomo：

1. 沙箱内：`getaddrinfo ENOTFOUND flomoapp.com`。
2. 沙箱外：DNS 结果触发 `private_or_reserved_address`，8 个目标全部按 SSRF 规则 fail closed。

没有把该结果解释为产品页面不存在，也没有通过 `allowedPrivateHosts`、固定 IP、关闭 DNS 复查或其他方式绕过安全边界。

## 未验证

- 修复已部署，且生产 `current` 构建的隔离 PageAudit 断言通过；但未创建第 4 份生产 H5 报告。
- 未验证生产运行时对 flomo 真实公网页面抓取后的站点基建分和建议文本。
- 是否需要把更多功能/下载页纳入动态发现不在本 Goal 范围。
