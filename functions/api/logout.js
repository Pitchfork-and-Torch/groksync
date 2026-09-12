export async function onRequestPost(context) {
  const secure = new URL(context.request.url).protocol === "https:" ? "; Secure" : "";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `groksync_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      "cache-control": "no-store",
    },
  });
}
