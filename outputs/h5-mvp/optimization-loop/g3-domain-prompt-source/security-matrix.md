# PageAudit 安全矩阵

| 风险 | 防护 | 固定证据 |
| --- | --- | --- |
| 私网/回环 | URL 解析后拒绝 IPv4、IPv6、IPv4-mapped IPv6 私网与保留段 | 127.0.0.1、10.0.0.8、::ffff:127.0.0.1 均在 fetch 前拒绝 |
| DNS rebinding | 每个跳转 hop 抓取前做两次解析并要求地址集合一致、均为公网 | 第二次解析转为 10.0.0.9 时 fail-close |
| 私网跳转 | `redirect: manual`，每一跳重新做 URL/DNS 校验 | 公网页跳转到 192.168.1.9，私网 URL 从未进入 fetchImpl |
| 循环/过多跳转 | 维护 visited 集合与最大跳转数 | 自循环返回 `redirect_loop` |
| MIME | 仅在成功响应接受对应 HTML/text/XML 类型 | octet-stream 返回 `unsupported_content_type` |
| 响应体积 | 先检查 Content-Length，再流式累计字节并在超限时 cancel | 2,000,001 字节声明被拒绝；无长度也受流式上限保护 |
| 超时 | 单次审计 AbortController 总时限 | AbortError 统一记录 `fetch_timeout` |
| 动态渲染 | 仅调用方显式注入 `renderPage`；只有 HTML shell 触发，结果仍受字节上限 | 静态/动态路径均有测试；缺少西安事实仍为 scope partial |

测试专用本地 HTTP fixture 仅在子进程环境设置 `PAGE_AUDIT_ALLOW_PRIVATE_HOSTS=127.0.0.1`。生产默认值为空，仍拒绝私网。
