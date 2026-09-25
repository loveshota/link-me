import { createSession, sessionCookie, verifyPassword } from "../_lib/auth.js";
import { verifyTotp } from "../_lib/totp.js";
import { getAdminConfig } from "../_lib/store.js";

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
  const config = await getAdminConfig(env);
  if (!config) {
    return json({ error: "尚未初始化，请先完成首次设置", setupRequired: true }, 409);
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

  const passwordOk = await verifyPassword(
    String(body?.password || ""),
    config.passwordSalt,
    config.passwordHash
  );
  const totpOk = await verifyTotp(config.totpSecret, String(body?.totp || ""));

  if (!passwordOk || !totpOk) {
    await env.CONTACTS_KV.put(failKey, String(failed + 1), { expirationTtl: 600 });
    return json({ error: "密码或动态验证码错误" }, 401);
  }

  await env.CONTACTS_KV.delete(failKey);
  const signingSecret = env.SESSION_SECRET || config.sessionSecret;
  const token = await createSession(signingSecret);
  return json(
    { ok: true },
    200,
    { "Set-Cookie": sessionCookie(token, request, SESSION_MAX_AGE) }
  );
}
