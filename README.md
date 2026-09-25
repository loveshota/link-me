# link-me

一个静态联系页面，方便部署到 Cloudflare Workers & Pages，让客户随时看到你的联系方式。

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 修改联系方式

编辑 `index.html`，替换以下占位符：

| 占位符 | 说明 |
| --- | --- |
| `Your Name` | 你的名字 / 昵称 |
| `Your Tagline` | 一句话简介 |
| `your@email.com` | 邮箱 |
| `+86 138 0000 0000` | 电话 |
| `your-wechat-id` | 微信号 |
| `@your_username` | Telegram 用户名 |
| `your-website.com` | 个人网站 |

不需要的联系方式，直接删除对应的 `<a class="link">...</a>` 即可。

## 部署到 Cloudflare Pages

1. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 选择本仓库 `link-me`。
3. 构建设置：
   - **Framework preset**: `None`
   - **Build command**: 留空
   - **Build output directory**: `/`
4. 点击 **Save and Deploy**，之后每次 push 会自动重新部署。

## 部署到 Cloudflare Workers（静态资源）

需要先安装 Wrangler：

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

配置见 `wrangler.toml`。

## 自定义域名

在 Pages / Workers 项目的 **Custom domains** 中添加你的域名，并按提示配置 DNS。
