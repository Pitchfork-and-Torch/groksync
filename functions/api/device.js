const ALLOWED = new Set(["pc", "mac", "phone", "agent", "other"]);

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
  const id = String(body?.id || "").toLowerCase().trim();
  if (!ALLOWED.has(id)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_device" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const raw = await kv.get("board");
  const board = raw
    ? JSON.parse(raw)
    : { devices: {}, pickup: [], sessions: [], claims: [], notes: [], journal: [], bots: [] };
  if (!board.devices) board.devices = {};
  board.devices[id] = {
    id,
    label: String(body.label || id),
    note: String(body.note || "").slice(0, 240),
    last_seen: new Date().toISOString(),
  };
  board.updated_at = new Date().toISOString();
  await kv.put("board", JSON.stringify(board));
  return new Response(JSON.stringify({ ok: true, device: board.devices[id] }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
