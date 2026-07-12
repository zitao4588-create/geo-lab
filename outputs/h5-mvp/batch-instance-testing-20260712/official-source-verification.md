# 官方入口核验

核验日期：2026-07-12

## 松下 ES-LM55

- 官方产品页：https://consumer.panasonic.cn/product/beauty-health/mens-shaver-grooming/shaver/ES-LM55.html
- 已确认：产品名为松下“大锤子2.0”剃须刀，型号 ES-LM55；页面列出五刀头、磁悬浮马达、IPX7 防水、续航和执行标准等产品信息。
- 用途：P01 ground truth；P02/E03 的 ES-LV9C 与 ES-LM55 冲突断言。

## 海底捞门店入口

- 官方门店搜索：https://www.haidilao.com/serve/storeSearch
- 已确认：该页面属于 `haidilao.com` 官方服务中心并提供门店搜索。
- 边界：全国品牌首页 `https://www.haidilao.com/` 只能证明品牌，不足以证明某一西安门店、服务半径、预约可用性或价格承诺。因此 L03 保留为来源范围不匹配测试。

## 证据边界

- 搜索结果只用于定位候选入口；上述结论以官方域名页面内容为依据。
- 没有保存个人联系方式、账号页、Cookie 或登录态。
- `example.invalid` 实例均明确作为缺少 ground truth 的确定性 fixture，不冒充真实官方来源。
