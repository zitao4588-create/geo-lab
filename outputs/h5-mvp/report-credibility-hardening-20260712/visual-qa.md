# 视觉 QA

日期：2026-07-12

## 检查面

- 390×844：冰箱小雷达报告顶部、可信度和指标区。
- 1440×1000：松下实体商品报告及桌面预览。
- 390×844：证据不足预检表单和提示卡。

## 结果

- 三个检查面均无横向溢出。
- 页面控制台无 error/warning。
- 报告可见“这份报告能确认什么”、正确实体识别、自然推荐、错误认知和模型冲突。
- 预检卡明确说明不会消耗免费名额或调用模型。
- 低证据状态不进入加载页，不生成伪精确报告。

机器结果：`visual-qa.json`。

## 截图

- `screenshots/preflight-card.png`
- `screenshots/preflight-mobile-390x844.png`
- `screenshots/fridge-mobile-390x844.png`
- `screenshots/fridge-390-full.png`
- `screenshots/fridge-desktop-1440.png`
- `screenshots/panasonic-mobile-390x844.png`
- `screenshots/panasonic-1440-full.png`
