import { isAuthenticated } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const authenticated = await isAuthenticated(request, env);
  return new Response(JSON.stringify({ authenticated }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
