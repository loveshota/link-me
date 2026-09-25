import { isAuthenticated } from "../_lib/auth.js";
import { getAdminConfig } from "../_lib/store.js";

export async function onRequestGet({ request, env }) {
  const [authenticated, config] = await Promise.all([
    isAuthenticated(request, env),
    getAdminConfig(env),
  ]);
  const payload = {
    authenticated,
    configured: !!config,
    setupTokenRequired: !!env.SETUP_TOKEN,
  };
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
