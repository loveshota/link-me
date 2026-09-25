import { getAdminConfig } from "./store.js";

const encoder = new TextEncoder();

export function randomHex(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const PBKDF2_ITERATIONS = 100000;

export async function hashPassword(password, saltBase64) {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return { salt: bytesToBase64(salt), hash: bytesToBase64(new Uint8Array(bits)) };
}

export async function verifyPassword(password, saltBase64, expectedHash) {
  const { hash } = await hashPassword(password, saltBase64);
  return timingSafeEqual(hash, expectedHash);
}

function bytesToBase64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToBase64url(text) {
  return bytesToBase64url(encoder.encode(text));
}

function base64urlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToBase64url(new Uint8Array(signature));
}

export function timingSafeEqual(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(secret, ttlMs = SESSION_TTL_MS) {
  const payload = textToBase64url(JSON.stringify({ exp: Date.now() + ttlMs }));
  const signature = await hmac(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return false;
  const index = token.lastIndexOf(".");
  const payload = token.slice(0, index);
  const signature = token.slice(index + 1);
  const expected = await hmac(payload, secret);
  if (!timingSafeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64urlToBytes(payload)));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return cookies;
}

export function sessionCookie(token, request, maxAgeSeconds) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const base = `Path=/; HttpOnly; SameSite=Strict${secure}`;
  if (maxAgeSeconds <= 0) return `${SESSION_COOKIE}=; ${base}; Max-Age=0`;
  return `${SESSION_COOKIE}=${token}; ${base}; Max-Age=${maxAgeSeconds}`;
}

export async function resolveSessionSecret(env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const config = await getAdminConfig(env);
  return config?.sessionSecret || null;
}

export async function isAuthenticated(request, env) {
  const secret = await resolveSessionSecret(env);
  if (!secret) return false;
  const cookies = parseCookies(request);
  return verifySession(cookies[SESSION_COOKIE], secret);
}
