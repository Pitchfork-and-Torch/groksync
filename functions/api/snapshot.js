import { emptyBoard, cleanFiles, cleanContext, cap } from "../_lib.js";

const ALLOWED_DEVICES = new Set(["pc", "mac", "phone", "iphone", "agent", "grok-bot", "other"]);

function scrubDevices(devices) {
  if (!devices || typeof devices !== "object") return {};
  const out = {};
  for (const [rawId, raw] of Object.entries(devices)) {
    const id = String(rawId || "").toLowerCase().trim();
    if (!ALLOWED_DEVICES.has(id)) continue;
    if (!raw || typeof raw !== "object") {
      out[id] = { id, label: id, note: "", last_seen: null };
      continue;
    }
    out[id] = {
      id,
      label: cap(raw.label || id, 40),
      note: cap(raw.note || "", 240),
      last_seen: raw.last_seen != null ? cap(String(raw.last_seen), 40) : null,
    };
  }
  return out;
}

function scrubSessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions.slice(0, 20).map((s) => {
    if (!s || typeof s !== "object") return s;
    const cwdRaw = s.cwd != null ? String(s.cwd) : "";
    const cwd = cwdRaw ? cleanFiles([cwdRaw])[0] || "" : cwdRaw;
    return {
      ...s,
      id: cap(s.id, 64),
      agent: cap(s.agent, 40),
      cwd,
    };
  });
}

function scrubClaims(claims) {
  if (!Array.isArray(claims)) return [];
  return claims.slice(0, 20).map((c) => {
    if (!c || typeof c !== "object") return c;
    return {
      ...c,
      project: cap(c.project, 80),
      note: cap(c.note, 240),
      session: cap(c.session, 64),
      paths: cleanFiles(c.paths || []),
    };
  });
}

function scrubPickup(pickup) {
  if (!Array.isArray(pickup)) return [];
  return pickup.slice(0, 12).map((item) => {
    if (!item || typeof item !== "object") return item;
    return {
      ...item,
      title: cap(item.title, 120),
      note: cap(item.note, 240),
    };
  });
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
  // Privacy: snapshot used to merge the body raw, so absolute cwd/paths and
  // unclean context bypassed cleanFiles / cleanContext (unlike /api/context).
  const next = {
    ...emptyBoard(),
    ...prev,
    ...body,
    devices: scrubDevices({ ...(prev.devices || {}), ...(body.devices || {}) }),
    sessions: scrubSessions(body.sessions ?? prev.sessions),
    claims: scrubClaims(body.claims ?? prev.claims),
    pickup: scrubPickup(body.pickup ?? prev.pickup),
    context:
      body.context !== undefined ? cleanContext(body.context) : prev.context ?? null,
    updated_at: new Date().toISOString(),
  };
  if (body.source_host != null) next.source_host = cap(body.source_host, 80);
  await kv.put("board", JSON.stringify(next));
  return new Response(JSON.stringify({ ok: true, updated_at: next.updated_at }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
