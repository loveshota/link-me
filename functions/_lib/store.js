export const CONTACTS_KEY = "contacts";
export const ADMIN_CONFIG_KEY = "admin:config";
export const PENDING_SETUP_PREFIX = "setup:pending:";
export const PENDING_SETUP_TTL = 600;

export const DEFAULT_CONTACTS = [
  { id: "email", icon: "✉️", label: "邮箱 Email", value: "your@email.com", href: "mailto:your@email.com" },
  { id: "telegram", icon: "➤", label: "Telegram", value: "@your_username", href: "https://t.me/your_username" },
  { id: "discord", icon: "🎮", label: "Discord", value: "your_username#0000", href: "https://discord.com/users/your_id" },
  { id: "x", icon: "𝕏", label: "X / Twitter", value: "@your_username", href: "https://x.com/your_username" },
  { id: "linkedin", icon: "💼", label: "LinkedIn", value: "linkedin.com/in/your_username", href: "https://www.linkedin.com/in/your_username" },
  { id: "instagram", icon: "📸", label: "Instagram", value: "@your_username", href: "https://www.instagram.com/your_username" },
  { id: "github", icon: "🐙", label: "GitHub", value: "github.com/loveshota", href: "https://github.com/loveshota" },
  { id: "website", icon: "🌐", label: "网站 Website", value: "your-website.com", href: "https://your-website.com" },
];

export async function getContacts(env) {
  const raw = await env.CONTACTS_KV.get(CONTACTS_KEY);
  if (!raw) return DEFAULT_CONTACTS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_CONTACTS;
  } catch {
    return DEFAULT_CONTACTS;
  }
}

export function sanitizeContacts(input) {
  if (!Array.isArray(input)) throw new Error("contacts must be an array");
  if (input.length > 50) throw new Error("too many contacts (max 50)");
  const clean = (value, max) => String(value ?? "").slice(0, max).trim();
  return input.map((item, index) => {
    const href = clean(item?.href, 500);
    if (href && !/^(https?:|mailto:|tel:)/i.test(href)) {
      throw new Error(`invalid href at index ${index}`);
    }
    return {
      id: clean(item?.id, 60) || `item-${index}-${Date.now()}`,
      icon: clean(item?.icon, 8) || "🔗",
      label: clean(item?.label, 60) || "未命名",
      value: clean(item?.value, 200),
      href: href || "#",
    };
  });
}

export async function saveContacts(env, contacts) {
  await env.CONTACTS_KV.put(CONTACTS_KEY, JSON.stringify(contacts));
}

export async function getAdminConfig(env) {
  const raw = await env.CONTACTS_KV.get(ADMIN_CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveAdminConfig(env, config) {
  await env.CONTACTS_KV.put(ADMIN_CONFIG_KEY, JSON.stringify(config));
}

export async function deleteAdminConfig(env) {
  await env.CONTACTS_KV.delete(ADMIN_CONFIG_KEY);
}

export async function putPendingSetup(env, id, totpSecret) {
  await env.CONTACTS_KV.put(PENDING_SETUP_PREFIX + id, totpSecret, {
    expirationTtl: PENDING_SETUP_TTL,
  });
}

export async function getPendingSetup(env, id) {
  if (!id) return null;
  return env.CONTACTS_KV.get(PENDING_SETUP_PREFIX + id);
}

export async function deletePendingSetup(env, id) {
  if (!id) return;
  await env.CONTACTS_KV.delete(PENDING_SETUP_PREFIX + id);
}
