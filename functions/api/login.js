import { createSession, sessionCookie, timingSafeEqual } from "../_lib/auth.js";
import { verifyTotp } from "../_lib/totp.js";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.TOTP_SECRET) {
    return json({ error: "服务端未配置 ADMIN_PASSWORD / SESSION_SECRET / TOTP_SECRET" }, 500);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const failKey = `login-fail:${ip}`;
  const failed = Number((await env.CONTACTS_KV.get(failKey)) || 0);
  if (failed >= 10) {
    return json({ error: "尝试次数过多，请 10 分钟后再试" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求格式错误" }, 400);
  }

  const passwordOk = timingSafeEqual(String(body?.password || ""), env.ADMIN_PASSWORD);
  const totpOk = await verifyTotp(env.TOTP_SECRET, String(body?.totp || ""));

  if (!passwordOk || !totpOk) {
    await env.CONTACTS_KV.put(failKey, String(failed + 1), { expirationTtl: 600 });
    return json({ error: "密码或动态验证码错误" }, 401);
  }

  await env.CONTACTS_KV.delete(failKey);
  const token = await createSession(env.SESSION_SECRET);
  return json(
    { ok: true },
    200,
    { "Set-Cookie": sessionCookie(token, request, SESSION_MAX_AGE) }
  );
}
