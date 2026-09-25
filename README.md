# link-me

基于 **Cloudflare Pages + Pages Functions + KV** 的联系方式展示页。公开页动态读取数据，管理员登录后可在后台直接增删改，无需再改代码。

## 架构

| 路径 | 说明 |
| --- | --- |
| `public/index.html` | 公开页，从 `/api/contacts` 读取并渲染 |
| `public/admin.html` | 管理后台（`/admin`），密码 + TOTP 登录后编辑 |
| `functions/api/contacts.js` | `GET` 公开读取；`PUT` 登录后保存（KV） |
| `functions/api/login.js` | 密码 + TOTP 校验，签发签名 Cookie |
| `functions/api/session.js` | 查询登录状态 |
| `functions/api/logout.js` | 退出登录 |
| `functions/_lib/` | 鉴权、TOTP、KV 读写逻辑 |
| `public/_headers` | 安全响应头 + 后台禁缓存 |
| `public/_routes.json` | 仅 `/api/*` 触发 Functions，静态资源直出 |
| `public/robots.txt` | 禁止抓取 `/admin`、`/api/` |
| `scripts/gen-2fa.mjs` | 生成 TOTP 密钥和二维码链接 |

数据存储在 KV 的 `contacts` 键中，未写入时使用默认占位数据。

## 首次配置

### 1. 安装依赖

```bash
npm install
```

### 2. 生成密钥

```bash
npm run gen-2fa
```

会输出 `TOTP_SECRET=...` 和一个 `otpauth://` 链接，用 Google Authenticator / Authy / 1Password 等扫码或手动添加。

再生成会话密钥：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### 3. 本地开发

复制环境变量示例并填写：

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` 内容：

```
ADMIN_PASSWORD=你的强密码
SESSION_SECRET=上一步生成的 64 位十六进制
TOTP_SECRET=gen-2fa 生成的密钥
```

启动本地服务（自带本地 KV）：

```bash
npm run dev
```

访问：

- 公开页 http://localhost:8788/
- 后台 http://localhost:8788/admin

## 部署到 Cloudflare Pages

### 方式 A：Git 集成（推荐）

1. 先在 Cloudflare 创建 KV 命名空间：**Workers & Pages → KV → Create namespace**，例如 `link-me-contacts`，复制它的 ID。
2. 把 `wrangler.toml` 中的 `id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"` 替换为该 ID，提交推送。
3. **Workers & Pages → Create → Pages → Connect to Git**，选择本仓库。
   - Build command：`exit 0`（无框架时使用）
   - Build output directory：`public`
4. 在 Pages 项目的 **Settings → Variables and Secrets** 添加加密变量：
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `TOTP_SECRET`
5. 在 **Settings → Functions → KV namespace bindings** 绑定变量名 `CONTACTS_KV` 到第 1 步的命名空间（`wrangler.toml` 已配置 ID 时可跳过）。
6. 重新部署，访问 `https://<项目>.pages.dev/admin` 登录管理。

> 生产环境变量在 **Settings → Variables and Secrets** 配置，与本地 `.dev.vars` 同名同值。
> `public/_routes.json` 只把 `/api/*` 交给 Functions，其余静态资源直接由 Pages 边缘返回，减少函数调用。

### 方式 B：命令行部署

```bash
npx wrangler login
npx wrangler pages project create link-me
npx wrangler pages secret put ADMIN_PASSWORD
npx wrangler pages secret put SESSION_SECRET
npx wrangler pages secret put TOTP_SECRET
npm run deploy
```

## 安全说明

- 后台入口 `/admin` 已加 `noindex` 与 `robots.txt`，但建议再配合 Cloudflare Access 或 IP 限制。
- 登录失败按 IP 累计，10 次/10 分钟后限流（HTTP 429），成功后清零。
- 会话 Cookie 为 HttpOnly、SameSite=Strict，HTTPS 下自动带 Secure；有效期 7 天。
- TOTP 校验允许前后 1 个时间窗（±30 秒）以容忍时钟偏差。
- `_headers` 已设置 CSP、X-Frame-Options、nosniff 等安全头。
- 只允许 `http(s)`、`mailto:`、`tel:` 协议的链接，拦截 `javascript:` 等注入。
- 不要提交 `.dev.vars`（已在 `.gitignore` 中）。

## 自定义域名

在 Pages 项目的 **Custom domains** 中添加域名并按提示配置 DNS。
