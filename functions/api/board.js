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
    context: null,
  };
}

export async function onRequestGet(context) {
  const kv = context.env.BOARD;
  if (!kv) {
    return new Response(JSON.stringify({ error: "kv_missing" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const raw = await kv.get("board");
  const board = raw ? JSON.parse(raw) : emptyBoard();
  return new Response(JSON.stringify(board), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
