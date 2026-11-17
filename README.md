# DSH Phone Control

网页端遥控另一台手机上的 **dsh-go**（DeepSeek Harness Android 客户端），发送任务并查看执行结果。

基于 [ccch1mneyyy/dsh-Go](https://github.com/ccch1mneyyy/dsh-Go)。

## 功能

- 连接通过隧道/反向代理暴露的手机 DSH Web
- 会话列表与新建
- 发送任务提示词（支持快捷任务）
- 基础历史查看与流式尝试
- 取消当前任务
- 本地保存连接配置
- 深色主题，移动端适配

## 使用前提

dsh-go 的本地引擎默认只监听 `127.0.0.1`，网页无法直接访问。你需要先把手机上的 DSH Web 暴露出来，常见方式：

1. **Cloudflare Tunnel**（推荐，免公网 IP）
2. **Tailscale** / 其他 VPN
3. 安装支持远程访问的 DSH 插件（如 `dsh-remote`、`dsh-web-remote`、`dsh-remote-v2` 等）
4. 在手机 Ubuntu 环境里用 `cloudflared` 或 `frp` 做反向代理

暴露后得到一个可访问的 URL（例如 `https://xxx.trycloudflare.com`），填入网页即可。

### 推荐插件（在手机 dsh-go 的本地引擎里安装）

```bash
# 示例（具体以插件市场为准）
dsh plugin --profile web add kelemiao/dsh-api
# 或
dsh plugin --profile web add @xgone/dsh-remote
```

本网页优先尝试 `/api/sessions` 等常见端点（兼容 dsh-api 风格），也支持原始 `/api/*` 透传。

## 部署到 GitHub Pages

1. 把本目录推到 GitHub 仓库
2. Settings → Pages → Source 选 `main` / `/(root)`
3. 访问 `https://<username>.github.io/<repo>/`

## 安全提示

- Token / 密码不要泄露
- 远程控制手机时注意权限（无障碍、确认级别）
- 敏感操作（支付、密码）建议保持默认确认
- 仅在可信网络或加密隧道下使用

## 开发

纯静态 HTML/CSS/JS，无需构建。直接打开 `index.html` 或部署到任意静态托管即可。

---

结合 [dsh-go](https://github.com/ccch1mneyyy/dsh-Go) 使用。
