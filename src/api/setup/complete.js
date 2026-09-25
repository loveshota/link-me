import { getAdminConfig, saveAdminConfig, getPendingSetup, deletePendingSetup } from "../../_lib/store.js";
import { verifyTotp } from "../../_lib/totp.js";
import { hashPassword, randomHex, createSession, sessionCookie } from "../../_lib/auth.js";

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
  if (await getAdminConfig(env)) {
    return json({ error: "管理员已初始化，无法重复设置" }, 409);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求格式错误" }, 400);
  }

  const setupId = String(body?.setupId || "");
  const password = String(body?.password || "");
  const totp = String(body?.totp || "");
  if (password.length < 8) return json({ error: "密码至少需要 8 位" }, 400);

  const totpSecret = await getPendingSetup(env, setupId);
  if (!totpSecret) {
    return json({ error: "初始化已过期，请重新开始" }, 410);
  }

  if (!(await verifyTotp(totpSecret, totp))) {
    return json({ error: "验证码错误，请核对后重试" }, 401);
  }

  const { salt, hash } = await hashPassword(password);
  const sessionSecret = randomHex(32);
  await saveAdminConfig(env, {
    passwordSalt: salt,
    passwordHash: hash,
    totpSecret,
    sessionSecret,
    createdAt: new Date().toISOString(),
  });
  await deletePendingSetup(env, setupId);

  const signingSecret = env.SESSION_SECRET || sessionSecret;
  const token = await createSession(signingSecret);
  return json(
    { ok: true },
    200,
    { "Set-Cookie": sessionCookie(token, request, SESSION_MAX_AGE) }
  );
}
