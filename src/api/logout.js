import { isAuthenticated, sessionCookie } from "../_lib/auth.js";

export async function onRequestPost({ request }) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": sessionCookie("", request, 0),
    },
  });
}
