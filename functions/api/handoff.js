import { emptyBoard, json, cap } from "../_lib.js";

const ALLOWED = new Set(["pc", "mac", "phone", "iphone", "agent", "grok-bot", "other"]);

export async function onRequestPost(context) {
  const kv = context.env.BOARD;
  if (!kv) return json({ ok: false, error: "kv_missing" }, 503);
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const id = String(body?.id || "").toLowerCase().trim();
  if (!ALLOWED.has(id)) return json({ ok: false, error: "bad_device" }, 400);
  const prevRaw = await kv.get("board");
  const board = prevRaw ? JSON.parse(prevRaw) : emptyBoard();
  if (!board.devices) board.devices = {};
  const now = new Date().toISOString();
  board.devices[id] = {
    id,
    label: cap(body.label || id, 40),
    note: cap(body.note || "handoff", 240),
    last_seen: now,
  };
  if (board.context && typeof board.context === "object") {
    board.context.source_device = id;
    board.context.updated_at = now;
  }
  board.updated_at = now;
  await kv.put("board", JSON.stringify(board));
  return json({ ok: true, device: board.devices[id], context: board.context });
}
