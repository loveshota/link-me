import { onRequestGet as getContacts, onRequestPut as putContacts } from "./api/contacts.js";
import { onRequestPost as login } from "./api/login.js";
import { onRequestPost as logout } from "./api/logout.js";
import { onRequestGet as session } from "./api/session.js";
import { onRequestPost as setupStart } from "./api/setup/start.js";
import { onRequestPost as setupComplete } from "./api/setup/complete.js";

const routes = [
  { method: "GET", path: "/api/contacts", handler: getContacts },
  { method: "PUT", path: "/api/contacts", handler: putContacts },
  { method: "POST", path: "/api/login", handler: login },
  { method: "POST", path: "/api/logout", handler: logout },
  { method: "GET", path: "/api/session", handler: session },
  { method: "POST", path: "/api/setup/start", handler: setupStart },
  { method: "POST", path: "/api/setup/complete", handler: setupComplete },
];

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      const normalized = pathname.replace(/\/+$/, "") || "/";
      const matches = routes.filter((route) => route.path === normalized);
      const route = matches.find((item) => item.method === request.method);
      if (route) {
        return route.handler({ request, env, ctx, params: {} });
      }
      if (matches.length > 0) {
        return json({ error: "Method Not Allowed" }, 405);
      }
      return json({ error: "Not Found" }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
