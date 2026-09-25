import { isAuthenticated } from "../_lib/auth.js";
import { getContacts, saveContacts, sanitizeContacts } from "../_lib/store.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function onRequestGet({ env }) {
  const contacts = await getContacts(env);
  return json({ contacts });
}

export async function onRequestPut({ request, env }) {
  if (!(await isAuthenticated(request, env))) {
    return json({ error: "未登录或会话已过期" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求格式错误" }, 400);
  }

  let contacts;
  try {
    contacts = sanitizeContacts(body?.contacts);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  await saveContacts(env, contacts);
  return json({ ok: true, contacts });
}
