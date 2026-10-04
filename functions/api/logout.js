import { SESSION_COOKIE, readCookie, sessionKvKey } from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = sessionKvKey(readCookie(request, SESSION_COOKIE));
  const kv = env.BOARD;
  if (key && kv && typeof kv.delete === "function") {
    try {
      await kv.delete(key);
    } catch {
      // Clear the cookie even if the store delete fails.
    }
  }
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      "cache-control": "no-store",
    },
  });
}
