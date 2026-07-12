# G3 双端视觉 QA

本地确定性 fixture：`diag_source_l01`，真实 provider 调用 0。

- 390×844：横向溢出 0；范围“部分匹配”、时效“可能过期”、受控动态渲染、canonical、内容哈希均可见。
- 1440×1000：同样五项可见，横向溢出 0。
- 浏览器控制台：错误 0，警告 0。
- 人工复核：移动端完整报告无卡片遮挡；桌面来源明细中长 canonical 正常换行。

截图：

- `screenshots/source-detail-mobile.png`
- `screenshots/source-detail-desktop.png`
- `screenshots/source-row-desktop.png`
