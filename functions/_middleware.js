/**
 * GrokSync auth gate.
 * Cookie session from POST /api/login.
 * Agent writes use Authorization: Bearer GROKSYNC_WRITE_TOKEN.
 * Password is Pages secret GROKSYNC_GATE_PASSWORD. Never in static JS.
 */

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

async function sessionToken(password) {
  const material = new TextEncoder().encode("groksync-v1|" + password);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return null;
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
  if (
    writeOk &&
    (path === "/api/snapshot" || path === "/api/device" || path === "/api/board")
  ) {
    return withNoStore(await next());
  }

  if (isPublicPath(path)) {
    return withNoStore(await next());
  }

  const password = env.GROKSYNC_GATE_PASSWORD;
  if (!password) {
    return new Response("GrokSync auth not configured (missing GROKSYNC_GATE_PASSWORD).", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const expected = await sessionToken(password);
  const got = getCookie(request, "groksync_session");
  if (got && got === expected) {
    return withNoStore(await next());
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
