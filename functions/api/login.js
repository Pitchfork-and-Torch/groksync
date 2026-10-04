import { SESSION_COOKIE, SESSION_MAX_AGE, newSessionId, sessionKvKey } from "../_lib.js";

function passwordsMatch(submitted, expected) {
  const a = new TextEncoder().encode(String(submitted));
  const b = new TextEncoder().encode(String(expected));
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0 && String(submitted).length > 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const expectedPwd = env.GROKSYNC_GATE_PASSWORD;
  if (!expectedPwd) {
    return new Response(JSON.stringify({ ok: false, error: "auth_not_configured" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const submitted = String(body?.password ?? "");
  if (!passwordsMatch(submitted, expectedPwd)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_password" }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const kv = env.BOARD;
  if (!kv || typeof kv.put !== "function") {
    return new Response(JSON.stringify({ ok: false, error: "session_store_missing" }), {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const sid = newSessionId();
  const key = sessionKvKey(sid);
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: "session_store_missing" }), {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  try {
    await kv.put(key, "1", { expirationTtl: SESSION_MAX_AGE });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "session_store_missing" }), {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie =
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": cookie,
      "cache-control": "no-store",
    },
  });
}
