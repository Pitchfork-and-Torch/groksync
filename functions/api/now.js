import { json, parseBoard } from "../_lib.js";

export async function onRequestGet(context) {
  const kv = context.env.BOARD;
  if (!kv) return json({ error: "kv_missing" }, 503);
  const board = parseBoard(await kv.get("board"));
  return json({
    updated_at: board.updated_at,
    source_host: board.source_host || null,
    context: board.context || null,
  });
}
