import { cleanContext, json, parseBoard } from "../_lib.js";

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
  prev.context = cleanContext(body);
  prev.updated_at = new Date().toISOString();
  await kv.put("board", JSON.stringify(prev));
  return json({ ok: true, context: prev.context });
}
