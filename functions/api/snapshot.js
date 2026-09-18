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

function scrubJournal(journal) {
  if (!Array.isArray(journal)) return [];
  return journal.slice(-12).map((j) => {
    if (!j || typeof j !== "object") return { kind: "note", message: "", ts: null };
    // Cap text; basename absolute path-looking messages (privacy invariant).
    const raw = String(j.message || "").trim();
    let message = cap(raw, 240);
    const looksAbs =
      /^([A-Za-z]:)?[\\/]/.test(raw) ||
      raw.includes("\\") ||
      raw.startsWith("~/");
    if (looksAbs) {
      const cleaned = cleanFiles([raw]);
      message =
        cleaned[0] ||
        cap(raw.split(/[\\/]/).filter(Boolean).pop() || "", 240);
    }
    return {
      kind: cap(j.kind || "note", 40),
      message,
      ts: j.ts != null ? cap(String(j.ts), 40) : null,
    };
  });
}

function scrubNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.slice(0, 20).map((n) => {
    if (!n || typeof n !== "object") return { text: cap(n, 240) };
    return {
      ...n,
      text: cap(n.text || n.note || n.message || "", 240),
      note: n.note != null ? cap(n.note, 240) : undefined,
      message: n.message != null ? cap(n.message, 240) : undefined,
    };
  });
}

function scrubBots(bots) {
  if (!Array.isArray(bots)) return [];
  return bots.slice(0, 20).map((b) => {
    if (!b || typeof b !== "object") return { id: cap(b, 40) };
    return {
      id: cap(b.id, 40),
      label: cap(b.label || b.id, 40),
      note: cap(b.note || "", 240),
      status: cap(b.status || "", 40),
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
  // Privacy: journal/notes/bots used to merge raw from body (paths/secrets).
  const next = {
    ...emptyBoard(),
    ...prev,
    ...body,
    devices: scrubDevices({ ...(prev.devices || {}), ...(body.devices || {}) }),
    sessions: scrubSessions(body.sessions ?? prev.sessions),
    claims: scrubClaims(body.claims ?? prev.claims),
    pickup: scrubPickup(body.pickup ?? prev.pickup),
    journal: scrubJournal(body.journal ?? prev.journal),
    notes: scrubNotes(body.notes ?? prev.notes),
    bots: scrubBots(body.bots ?? prev.bots),
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
