function emptyBoard() {
  return {
    updated_at: null,
    source_host: null,
    pickup: [],
    sessions: [],
    claims: [],
    notes: [],
    journal: [],
    devices: {},
    bots: [],
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.BOARD;
  if (!kv) {
    return new Response(JSON.stringify({ ok: false, error: "kv_missing" }), {
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

  const prevRaw = await kv.get("board");
  const prev = prevRaw ? JSON.parse(prevRaw) : emptyBoard();
  const next = {
    ...emptyBoard(),
    ...prev,
    ...body,
    devices: { ...(prev.devices || {}), ...(body.devices || {}) },
    updated_at: new Date().toISOString(),
  };
  await kv.put("board", JSON.stringify(next));
  return new Response(JSON.stringify({ ok: true, updated_at: next.updated_at }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
