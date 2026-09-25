# link-me

基于 **Cloudflare Pages + Pages Functions + KV** 的联系方式展示页。公开页动态读取数据，管理员首次访问时设置密码并绑定 2FA，之后在后台直接增删改，无需改代码。

## 架构

| 路径 | 说明 |
| --- | --- |
| `public/index.html` | 公开页，从 `/api/contacts` 读取并渲染 |
| `public/admin.html` | 管理后台（`/admin`）：首次初始化 / 登录 / 编辑 |
| `functions/api/setup/start.js` | 初始化第一步：校验密码，生成 TOTP 密钥与二维码 |
| `functions/api/setup/complete.js` | 初始化第二步：验证 TOTP，保存管理员配置并自动登录 |
| `functions/api/login.js` | 密码 + TOTP 登录，签发签名 Cookie |
| `functions/api/session.js` | 返回登录状态与是否已初始化 |
| `functions/api/logout.js` | 退出登录 |
| `functions/api/contacts.js` | `GET` 公开读取；`PUT` 登录后保存（KV） |
| `functions/_lib/` | 鉴权、密码哈希、TOTP、二维码、KV 读写 |
| `public/_headers` | 安全响应头 + 后台禁缓存 |
| `public/_routes.json` | 仅 `/api/*` 触发 Functions，静态资源直出 |
| `public/robots.txt` | 禁止抓取 `/admin`、`/api/` |

数据存储在 KV：`admin:config`（管理员凭据）与 `contacts`（联系方式，未写入时用默认占位数据）。

## 首次访问即初始化（无需预置环境变量）

部署后打开 `https://<项目>.pages.dev/admin`：

1. 系统检测到未初始化，显示**首次初始化**向导。
2. 设置管理员密码（至少 8 位）。
3. 页面生成 2FA 二维码，用 Google Authenticator / Authy / 1Password 等扫描，输入 6 位验证码完成绑定。
4. 绑定成功即自动登录，进入编辑界面。

密码用 PBKDF2-SHA256（10 万次迭代 + 随机盐）存储；TOTP 密钥和会话密钥在初始化时随机生成并写入 KV，因此**无需配置任何环境变量**。

> ⚠️ 由于是“首次访问即初始化”，项目 URL 一旦被他人先访问并完成初始化，他就成了管理员。若 URL 可能泄露，请设置可选变量 `SETUP_TOKEN`（见下），初始化时必须填写相同口令。

## 本地开发

```bash
npm install
npm run dev
```

- 公开页 http://localhost:8788/
- 后台 http://localhost:8788/admin （首次访问进入初始化向导）

本地默认不校验初始化口令。如需模拟，创建 `.dev.vars`（参考 `.dev.vars.example`）：

```
SETUP_TOKEN=my-setup-token
APP_NAME=link-me
```

`npm run dev` 自带本地 KV，无需额外配置。

## 部署到 Cloudflare Pages

### 方式 A：Git 集成（推荐）

1. 在 Cloudflare 创建 KV 命名空间：**Workers & Pages → KV → Create namespace**，例如 `link-me-contacts`，复制 ID。
2. 把 `wrangler.toml` 里的 `id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"` 替换为该 ID，提交推送。
3. **Workers & Pages → Create → Pages → Connect to Git**，选择本仓库：
   - Build command：`exit 0`
   - Build output directory：`public`
4. 在 **Settings → Functions → KV namespace bindings** 绑定变量名 `CONTACTS_KV` 到第 1 步的命名空间（`wrangler.toml` 已配置 ID 时可跳过）。
5. （可选）在 **Settings → Variables and Secrets** 添加 `SETUP_TOKEN`，防止他人抢先初始化。
6. 部署完成后访问 `https://<项目>.pages.dev/admin` 完成初始化。

### 方式 B：命令行部署

```bash
npx wrangler login
npx wrangler pages project create link-me
npm run deploy
# 可选：初始化口令
npx wrangler pages secret put SETUP_TOKEN
```

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

在 Pages 项目的 **Custom domains** 中添加域名并按提示配置 DNS。
