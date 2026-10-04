/**
 * GrokSync auth gate.
 * Cookie session from POST /api/login.
 * Agent CLI uses Authorization: Bearer (host write token) on WRITE_API_PATHS.
 * Gate password is a host secret. Never in the static JS bundle.
 */
import { SESSION_COOKIE, WRITE_API_PATHS, readCookie, sessionKvKey } from "./_lib.js";

const PUBLIC_EXACT = new Set([
  "/login",
  "/login.html",
  "/favicon.ico",
  "/favicon.svg",
  "/robots.txt",
]);

function isPublicPath(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/public/")) return true;
  if (pathname === "/css/tokens.css" || pathname === "/css/app.css") return true;
  return false;
}

function bearer(request) {
  const h = request.headers.get("Authorization") || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return "";
}

function withNoStore(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  headers.set("Pragma", "no-cache");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  if (path === "/api/login" || path === "/api/logout") {
    return withNoStore(await next());
  }

  const writeTok = env.GROKSYNC_WRITE_TOKEN || "";
  const gotBearer = bearer(request);
  const writeOk = Boolean(writeTok) && gotBearer && gotBearer === writeTok;
  if (writeOk && WRITE_API_PATHS.has(path)) {
    return withNoStore(await next());
  }

  if (isPublicPath(path)) {
    return withNoStore(await next());
  }

  const password = env.GROKSYNC_GATE_PASSWORD;
  if (!password) {
    return new Response("GrokSync auth not configured.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const kv = env.BOARD;
  const got = readCookie(request, SESSION_COOKIE);
  const key = sessionKvKey(got);
  if (kv && typeof kv.get === "function" && key) {
    try {
      const row = await kv.get(key);
      if (row) return withNoStore(await next());
    } catch {
      // Missing or broken store does not accept the cookie.
    }
  }

  const accept = request.headers.get("Accept") || "";
  if (
    path.startsWith("/api/") ||
    path.startsWith("/js/") ||
    path.endsWith(".json") ||
    accept.includes("application/json")
  ) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}
