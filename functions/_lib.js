export function emptyBoard() {
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

/** Agent bearer may call these paths (read or write). Cookie still covers the rest. */
export const WRITE_API_PATHS = new Set([
  "/api/snapshot",
  "/api/device",
  "/api/board",
  "/api/now",
  "/api/context",
  "/api/handoff",
]);

export const DEVICE_IDS = new Set(["pc", "mac", "phone", "agent", "other"]);
export const DEVICE_ALIASES = { iphone: "phone", ios: "phone" };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function cap(s, n) {
  return String(s || "").slice(0, n);
}

export function parseBoard(raw) {
  if (!raw) return emptyBoard();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return emptyBoard();
    return data;
  } catch {
    return emptyBoard();
  }
}

export function normalizeDeviceId(raw) {
  const id = String(raw || "").toLowerCase().trim();
  const mapped = DEVICE_ALIASES[id] || id;
  return DEVICE_IDS.has(mapped) ? mapped : null;
}

/**
 * Redact a path to a slug. Already-slugged ~/... values stay.
 * Absolute / home paths become ~/basename so the board never stores a home dir.
 */
export function slugPath(p) {
  if (p == null) return "";
  let s = String(p).replace(/\\/g, "/").trim();
  if (!s || s.includes("\0") || s.includes("..")) return "";
  if (s === "~") return "~";
  if (s.startsWith("~/")) {
    const rest = s.slice(2).replace(/^\/+/, "");
    if (!rest || rest.includes("..")) return "";
    return cap("~/" + rest, 180);
  }
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  s = s.replace(/^([A-Za-z]:)?\/+/, "");
  s = s.replace(/^(Users|home)\/[^/]+\/?/i, "");
  const parts = s.split("/").filter(Boolean);
  if (!parts.length) return "";
  const name = parts[parts.length - 1];
  if (!name || name === ".") return "";
  return cap("~/" + name, 180);
}

export function cleanFiles(files) {
  if (!Array.isArray(files)) return [];
  const out = [];
  for (const f of files.slice(0, 12)) {
    let s = String(f || "").replace(/\\/g, "/").trim();
    if (!s || s.includes("..") || s.includes("\0")) continue;
    s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
    s = s.replace(/^([A-Za-z]:)?\/+/, "");
    s = s.replace(/^(Users|home)\/[^/]+\/?/i, "");
    if (!s || s.includes("..")) continue;
    out.push(s.slice(0, 180));
  }
  return out;
}

export function cleanContext(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== "object") return null;
  const project = cap(raw.project, 80).replace(/[\\/]/g, "-");
  const ctx = {
    updated_at: now,
    source_device: cap(raw.source_device, 24) || null,
    project,
    branch: cap(raw.branch, 80),
    claim: cap(raw.claim, 40),
    note: cap(raw.note, 240),
    next: cap(raw.next, 240),
    files: cleanFiles(raw.files),
    enc: raw.enc && typeof raw.enc === "object" ? raw.enc : null,
  };
  if (ctx.enc) {
    ctx.note = "";
    ctx.next = "";
    ctx.files = [];
  }
  return ctx;
}

function cleanList(arr, fn, n) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr.slice(0, n)) {
    if (!item || typeof item !== "object") continue;
    const cleaned = fn(item);
    if (cleaned) out.push(cleaned);
  }
  return out;
}

function cleanPickup(p) {
  const title = cap(p.title, 120);
  const note = cap(p.note, 240);
  if (!title && !note) return null;
  return { title, note };
}

function cleanSession(s) {
  return {
    id: cap(s.id, 64),
    cwd: slugPath(s.cwd),
    agent: cap(s.agent, 40),
    alive: Boolean(s.alive),
    opened: cap(s.opened, 40),
  };
}

function cleanClaim(c) {
  const paths = Array.isArray(c.paths)
    ? c.paths.map(slugPath).filter(Boolean).slice(0, 8)
    : [];
  return {
    project: cap(c.project, 80).replace(/[\\/]/g, "-"),
    note: cap(c.note, 240),
    session: cap(c.session, 40),
    paths,
  };
}

function cleanNote(n) {
  const title = cap(n.title, 80);
  const body = cap(n.body || n.note, 240);
  if (!title && !body) return null;
  return { title, body };
}

function cleanJournal(j) {
  const message = cap(j.message, 240);
  const kind = cap(j.kind, 40) || "note";
  if (!message && !j.ts) return null;
  return { kind, message, ts: cap(j.ts, 40) };
}

function cleanBot(b) {
  const id = cap(b.id, 40);
  if (!id) return null;
  return { id, label: cap(b.label || id, 40), note: cap(b.note, 240) };
}

function cleanDevice(id, d) {
  return {
    id,
    label: cap(d.label || id, 40),
    note: cap(d.note, 240),
    last_seen: cap(d.last_seen, 40),
  };
}

function scrubDevices(map) {
  const devices = {};
  if (!map || typeof map !== "object" || Array.isArray(map)) return devices;
  for (const [k, v] of Object.entries(map)) {
    if (!v || typeof v !== "object") continue;
    const id = normalizeDeviceId(v.id || k);
    if (!id) continue;
    devices[id] = cleanDevice(id, v);
  }
  return devices;
}

/**
 * Snapshot updates lists + devices + source_host.
 * Continue packet (context) is owned by /api/context and is never taken from a snapshot body.
 */
export function mergeSnapshot(prev, body, now = new Date().toISOString()) {
  const base = { ...emptyBoard(), ...(prev && typeof prev === "object" ? prev : {}) };
  const src = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const devices = { ...scrubDevices(base.devices) };
  if (src.devices && typeof src.devices === "object" && !Array.isArray(src.devices)) {
    Object.assign(devices, scrubDevices(src.devices));
  }
  const pick = (key, fn, n) =>
    cleanList(src[key] !== undefined ? src[key] : base[key], fn, n);
  const hostSrc = src.source_host !== undefined ? src.source_host : base.source_host;
  return {
    updated_at: now,
    source_host: cap(hostSrc, 80) || null,
    pickup: pick("pickup", cleanPickup, 12),
    sessions: pick("sessions", cleanSession, 20),
    claims: pick("claims", cleanClaim, 20),
    notes: pick("notes", cleanNote, 20),
    journal: pick("journal", cleanJournal, 12),
    devices,
    bots: pick("bots", cleanBot, 12),
    context: base.context && typeof base.context === "object" ? base.context : null,
  };
}

/** Read-time net: slug paths and cap strings without changing updated_at. */
export function redactBoard(raw) {
  const prev = raw && typeof raw === "object" ? raw : emptyBoard();
  const stamp = cap(prev.updated_at, 40) || null;
  const out = mergeSnapshot(prev, prev, stamp || new Date().toISOString());
  out.updated_at = stamp;
  if (prev.context && typeof prev.context === "object") {
    const c = prev.context;
    out.context = {
      updated_at: cap(c.updated_at, 40) || null,
      source_device: cap(c.source_device, 24) || null,
      project: cap(c.project, 80).replace(/[\\/]/g, "-"),
      branch: cap(c.branch, 80),
      claim: cap(c.claim, 40),
      note: cap(c.note, 240),
      next: cap(c.next, 240),
      files: cleanFiles(c.files),
      enc: c.enc && typeof c.enc === "object" ? c.enc : null,
    };
    if (out.context.enc) {
      out.context.note = "";
      out.context.next = "";
      out.context.files = [];
    }
  } else {
    out.context = null;
  }
  return out;
}
