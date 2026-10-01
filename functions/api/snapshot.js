import { json, mergeSnapshot, parseBoard } from "../_lib.js";

export async function onRequestPost(context) {
  const kv = context.env.BOARD;
  if (!kv) return json({ ok: false, error: "kv_missing" }, 503);
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const prev = parseBoard(await kv.get("board"));
  const next = mergeSnapshot(prev, body);
  await kv.put("board", JSON.stringify(next));
  return json({ ok: true, updated_at: next.updated_at });
}
