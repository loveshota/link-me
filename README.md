# link-me

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/loveshota/link-me)

基于 **Cloudflare Workers + 静态资源 + KV** 的联系方式展示页。公开页动态读取数据，管理员首次访问时设置密码并绑定 2FA，之后在后台直接增删改，无需改代码。

## 一键部署

点击上方 **Deploy to Cloudflare** 按钮即可，全程图形化：

1. 登录并授权 GitHub 与 Cloudflare 权限；
2. Cloudflare 会把本仓库克隆到你自己的 GitHub 账号；
3. 自动创建并绑定 KV 命名空间 `CONTACTS_KV`（无需手动建库、填 ID）；
4. 自动配置 Workers Builds（CI/CD）并完成部署，之后每次 push 自动构建发布。

> 仓库需为 **public**，一键部署按钮才可用。整个流程**无需手动填写任何内容**：KV 自动创建、`APP_NAME` 等均有默认值，直接点下一步即可。若担心他人抢先初始化管理员，可在部署完成后另行设置 `SETUP_TOKEN`（见「安全说明」）。

也可以把仓库 URL 直接粘到 [deploy.workers.cloudflare.com](https://deploy.workers.cloudflare.com/) 使用。

## 架构

| 路径 | 说明 |
| --- | --- |
| `src/index.js` | Worker 入口：路由 `/api/*`，其余请求交给静态资源 |
| `public/index.html` | 公开页，从 `/api/contacts` 读取并渲染 |
| `public/admin.html` | 管理后台（`/admin`）：首次初始化 / 登录 / 编辑 |
| `src/api/setup/start.js` | 初始化第一步：校验密码，生成 TOTP 密钥与二维码 |
| `src/api/setup/complete.js` | 初始化第二步：验证 TOTP，保存管理员配置并自动登录 |
| `src/api/login.js` | 密码 + TOTP 登录，签发签名 Cookie |
| `src/api/session.js` | 返回登录状态与是否已初始化 |
| `src/api/logout.js` | 退出登录 |
| `src/api/contacts.js` | `GET` 公开读取；`PUT` 登录后保存（KV） |
| `src/_lib/` | 鉴权、密码哈希、TOTP、二维码、KV 读写 |
| `public/_headers` | 安全响应头 + 后台禁缓存 |
| `public/robots.txt` | 禁止抓取 `/admin`、`/api/` |
| `wrangler.toml` | Worker 配置：入口、静态资源目录、KV 绑定 |

数据存储在 KV：`admin:config`（管理员凭据）与 `contacts`（联系方式，未写入时用默认占位数据）。

## 首次访问即初始化（无需预置环境变量）

部署后打开 `https://<worker>.<your-subdomain>.workers.dev/admin`：

1. 系统检测到未初始化，显示**首次初始化**向导。
2. 设置管理员密码（至少 8 位）。
3. 页面生成 2FA 二维码，用 Google Authenticator / Authy / 1Password 等扫描，输入 6 位验证码完成绑定。
4. 绑定成功即自动登录，进入编辑界面。

密码用 PBKDF2-SHA256（10 万次迭代 + 随机盐）存储；TOTP 密钥和会话密钥在初始化时随机生成并写入 KV，因此**无需配置任何环境变量**。

> ⚠️ 由于是“首次访问即初始化”，项目 URL 一旦被他人先访问并完成初始化，他就成了管理员。若 URL 可能泄露，请设置 `SETUP_TOKEN`（见下），初始化时必须填写相同口令。

## 本地开发

```bash
npm install
npm run dev
```

- 公开页 http://localhost:8787/
- 后台 http://localhost:8787/admin （首次访问进入初始化向导）

本地默认不校验初始化口令。如需模拟，创建 `.dev.vars`（参考 `.dev.vars.example`）：

```
SETUP_TOKEN=my-setup-token
APP_NAME=link-me
```

`npm run dev` 自带本地 KV，无需额外配置。

## 其他部署方式

### 命令行部署

```bash
npm install
npx wrangler login
npx wrangler deploy
# 首次部署会提示自动创建 KV 命名空间；也可手动创建：
# npx wrangler kv namespace create CONTACTS_KV   然后把返回的 id 填回 wrangler.toml

# 可选：初始化口令
npx wrangler secret put SETUP_TOKEN

# 可选：固定会话签名密钥（64 位十六进制）
npx wrangler secret put SESSION_SECRET
```

### Git 集成（Workers Builds）

在 **Workers & Pages → Create → Workers → Import a repository** 选择本仓库：

- Build command：留空
- Deploy command：`npx wrangler deploy`

`wrangler.toml` 已声明 KV 绑定，首次构建会自动创建命名空间；也可在 **Settings → Bindings** 手动绑定 `CONTACTS_KV`。

## 安全说明

- 首次初始化后，`/api/setup/start` 与 `/api/setup/complete` 会直接返回 409，无法重复设置。
- 初始化口令（`SETUP_TOKEN`）可选，用于防止他人抢先占用管理员。
- 登录失败按 IP 累计，10 次/10 分钟后限流（HTTP 429），成功后清零。
- 密码 PBKDF2-SHA256，10 万次迭代 + 16 字节随机盐。
- 会话 Cookie 为 HttpOnly、SameSite=Strict，HTTPS 下自动带 Secure，有效期 7 天。
- TOTP 校验允许前后 1 个时间窗（±30 秒）以容忍时钟偏差。
- 后台 `_headers` 设置 `no-store`、`noindex`，并配置 CSP、X-Frame-Options 等安全头。
- 仅允许 `http(s)`、`mailto:`、`tel:` 协议链接，拦截 `javascript:` 等注入。
- 忘记密码：删除 KV 中的 `admin:config` 键即可重新初始化；不要提交 `.dev.vars`。

## 自定义域名

在 Worker 的 **Settings → Domains & Routes → Add custom domain** 中添加域名并按提示配置 DNS。
