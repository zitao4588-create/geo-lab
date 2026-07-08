# AI曝光体检 H5 生产运行说明

目标域名：`https://exposure.playgamelab.cn`

## 范围

第一阶段只上线 H5 MVP：

- React/Vite 静态 H5。
- Node/Express API。
- 本地 JSON runtime 存储。
- DeepSeek `deepseek-v4-pro` 真实问答采样。
- 单一 `GEO 分析成果得分` 报告。
- `runtime/evidence/<reportId>/` 证据目录。
- 公开 URL 审计：homepage/privacy/features/FAQ/geo-case/robots/sitemap/llms。
- Markdown/HTML/evidence package 导出；PDF 可由 HTML 报告生成。

不包含数据库、登录、支付、Docker、后台管理、小程序或自动部署系统。

## 服务器环境变量

真实环境变量只放服务器安全位置，例如：

```text
/opt/playgamelab/ai-exposure-check-h5/.env
```

建议权限：

```bash
chmod 600 /opt/playgamelab/ai-exposure-check-h5/.env
```

示例键名：

```bash
PORT=3020
RUNTIME_DIR=/opt/playgamelab/ai-exposure-check-h5/runtime
DIAGNOSES_IP_HOURLY_LIMIT=1
DIAGNOSES_GLOBAL_DAILY_LIMIT=30
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_API_KEY=
```

前端微信号展示使用 Vite 构建期变量：

```bash
VITE_CONSULT_WECHAT_ID=
```

如果没有配置具体微信号，结果页咨询弹层仍会展示二维码，但复制按钮只复制添加说明。

不要把真实 `DEEPSEEK_API_KEY`、腾讯云 `SecretId`、`SecretKey`、服务器 IP 或 SSH 私钥写入仓库、文档、日志、前端 bundle 或输出报告。

## systemd 建议

服务名建议：

```text
ai-exposure-check-h5.service
```

运行方式：

```text
WorkingDirectory=/opt/playgamelab/ai-exposure-check-h5/current
Environment=NODE_ENV=production
EnvironmentFile=/opt/playgamelab/ai-exposure-check-h5/.env
ExecStart=/usr/bin/node dist/server/server/index.js
Restart=on-failure
```

Node 服务只监听 `127.0.0.1`，不要直接暴露公网端口。

## Caddy 建议

Caddy 站点块：

```caddy
exposure.playgamelab.cn {
	reverse_proxy 127.0.0.1:3020
}
```

修改前先读取现有 `/etc/caddy/Caddyfile` 并备份。修改后执行：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 回滚方式

优先使用 release 目录和 `current` symlink：

```text
/opt/playgamelab/ai-exposure-check-h5/releases/<timestamp>
/opt/playgamelab/ai-exposure-check-h5/current -> releases/<timestamp>
```

如果新版本失败，把 `current` 指回上一个 release，重启 systemd 服务，再执行 smoke test。不要批量删除旧 release；确认稳定后再手动清理。

## 上线后 smoke test

本地或服务器执行：

```bash
curl -I https://exposure.playgamelab.cn/
curl -sS https://exposure.playgamelab.cn/api/health
curl -I https://exposure.playgamelab.cn/robots.txt
curl -I https://exposure.playgamelab.cn/sitemap.xml
curl -I https://exposure.playgamelab.cn/ai-exposure-check.html
```

再提交一个不含真实隐私的测试 payload 到：

```text
POST https://exposure.playgamelab.cn/api/diagnoses
```

验收点：

- 首页返回 200。
- `/api/health` 返回 `model=deepseek-v4-pro`。
- `/robots.txt` 返回 `text/plain`，并指向 `https://exposure.playgamelab.cn/sitemap.xml`。
- `/sitemap.xml` 返回 `application/xml`，并列出首页、静态介绍页、隐私政策和用户协议。
- `/ai-exposure-check.html` 返回独立静态 HTML，不应被 SPA fallback 成首页。
- `POST /api/diagnoses` 返回报告 ID，且 `aiMeta.successCount > 0`。
- `GET /api/diagnoses/:id` 可刷新查询。
- `GET /api/diagnoses/:id/evidence` 返回证据索引。
- `GET /api/diagnoses/:id/export/markdown` 返回 Markdown。
- `GET /api/diagnoses/:id/export/html` 返回 HTML。
- `GET /api/diagnoses/:id/export/evidence-package` 返回证据包 JSON。
- 前端 bundle 不包含 API key。
- 公开报告不展示联系方式。
- 移动端和桌面端截图无明显溢出。

## 合规占位

H5 首页展示隐私政策、用户协议和备案号占位。正式公开商业化前需要单独复核：

- ICP 备案展示口径。
- 公安备案展示口径。
- 主体、收费、微信支付和小程序备案边界。
