import { emptyBoard, json, parseBoard, redactBoard } from "../_lib.js";

export async function onRequestGet(context) {
  const kv = context.env.BOARD;
  if (!kv) return json({ error: "kv_missing" }, 503);
  const raw = await kv.get("board");
  const board = raw ? redactBoard(parseBoard(raw)) : emptyBoard();
  return json(board);
}
