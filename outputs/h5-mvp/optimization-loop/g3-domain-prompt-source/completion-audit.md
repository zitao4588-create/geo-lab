# G3 完成审计

## 专属验收

- [x] 三类业务表驱动问题不串类。
- [x] 商品覆盖主型号、规格、安全、渠道、耗材、保修、同口径比较。
- [x] 软件覆盖功能、输入输出、隐私、主体、适用人群、限制、替代方案。
- [x] 本地服务覆盖距离、门店、营业时间、排队、预约、服务/菜单、价格、停车、过敏、儿童服务；无加盟/企业采购/合同模板。
- [x] L01 保持 scope partial；L03 保持 scope mismatched；L04 未证明承诺仍待核验。
- [x] 静态抓取、受控动态渲染与安全拒绝路径有固定测试；安全用例没有真实访问私网。
- [x] 私网、重定向、DNS rebinding、大小、MIME、超时、循环跳转均 fail-close。
- [x] 来源记录 URL、final URL、标题、canonical、命中片段、抓取时间、内容哈希、时效和抓取方式。
- [x] H5、Markdown、HTML、evidence package 使用同一范围/时效/canonical/hash 数据。
- [x] 本地候选接口仅接收用户提交 URL，状态恒为 pending_review，不自动 verified，不发搜索请求。

## 通用验收

- [x] `npm run typecheck`
- [x] `npm test`：73/73
- [x] `npm run build`
- [x] `git diff --check`
- [x] 390×844 与 1440×1000 浏览器检查通过，console 0/0
- [x] 输出敏感信息扫描无命中
- [x] 真实 provider 调用 0
- [x] 未 commit、push、部署、生产写入、搜索调用或云账号修改

完成等级：C2。
