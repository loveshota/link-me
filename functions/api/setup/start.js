import { getAdminConfig, putPendingSetup } from "../../_lib/store.js";
import { generateTotpSecret, otpauthUri } from "../../_lib/totp.js";
import { makeQrSvg } from "../../_lib/qr.js";
import { randomHex, timingSafeEqual } from "../../_lib/auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
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

  if (env.SETUP_TOKEN && !timingSafeEqual(String(body?.setupToken || ""), env.SETUP_TOKEN)) {
    return json({ error: "初始化口令错误" }, 403);
  }

  const password = String(body?.password || "");
  if (password.length < 8) return json({ error: "密码至少需要 8 位" }, 400);
  if (password.length > 200) return json({ error: "密码过长" }, 400);

  const totpSecret = generateTotpSecret();
  const setupId = randomHex(16);
  await putPendingSetup(env, setupId, totpSecret);

  const otpauth = otpauthUri(totpSecret, "admin", env.APP_NAME || "link-me");
  return json({ setupId, secret: totpSecret, otpauth, qrSvg: makeQrSvg(otpauth) });
}
