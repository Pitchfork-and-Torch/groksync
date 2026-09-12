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

export function cleanFiles(files) {
  if (!Array.isArray(files)) return [];
  const out = [];
  for (const f of files.slice(0, 12)) {
    const s = String(f || "").replace(/\\/g, "/").replace(/^([A-Za-z]:)?\/+/, "");
    if (!s || s.includes("..")) continue;
    out.push(s.slice(0, 180));
  }
  return out;
}

export function cleanContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  const project = cap(raw.project, 80).replace(/[\\/]/g, "-");
  const ctx = {
    updated_at: new Date().toISOString(),
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
