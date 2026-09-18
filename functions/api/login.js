async function sessionToken(password) {
  const material = new TextEncoder().encode("groksync-v1|" + password);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const got = await sessionToken(submitted);
  const want = await sessionToken(expectedPwd);
  if (!submitted || got !== want) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_password" }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie =
    `groksync_session=${encodeURIComponent(want)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": cookie,
      "cache-control": "no-store",
    },
  });
}
