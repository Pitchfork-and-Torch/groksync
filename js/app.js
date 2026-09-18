function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function ago(iso) {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}

function empty(msg) {
  return `<p class="empty">${esc(msg)}</p>`;
}

function rows(items, fn) {
  if (!items || !items.length) return empty("None.");
  return items.map(fn).join("");
}

function renderContinue(ctx) {
  const el = document.getElementById("continue");
  if (!el) return;
  if (!ctx || !ctx.project) {
    el.innerHTML = empty("No continue packet yet. Set one from the CLI.");
    return;
  }
  const files = (ctx.files || []).slice(0, 3).join(" · ");
  el.innerHTML = `<p class="packet-title">${esc(ctx.project)}</p>
    <p class="packet-note">${esc(ctx.note || ctx.next || "Packet present.")}</p>
    <dl class="meta-grid">
      <div class="meta"><dt>Seat</dt><dd>${esc(ctx.source_device || "-")}</dd></div>
      <div class="meta"><dt>Next</dt><dd>${esc(ctx.next || "-")}</dd></div>
      <div class="meta"><dt>Claim</dt><dd>${esc(ctx.claim || "-")}</dd></div>
      <div class="meta"><dt>Files</dt><dd>${esc(files || "-")}</dd></div>
    </dl>
    <p class="packet-actions"><button type="button" id="packet-file">Save packet file</button></p>`;
  const btn = document.getElementById("packet-file");
  if (btn) {
    btn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(ctx, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "groksync-packet.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

function render(board) {
  document.getElementById("updated").textContent = board.updated_at
    ? "Updated " + ago(board.updated_at) + (board.source_host ? " from " + board.source_host : "")
    : "No snapshot yet. Publish from the CLI.";
  renderContinue(board.context);

  const devices = Object.values(board.devices || {});
  document.getElementById("devices").innerHTML = rows(devices, (d) => {
    const live = d.last_seen && Date.now() - Date.parse(d.last_seen) < 2 * 60 * 60 * 1000;
    return `<div class="row"><div><span class="dot ${live ? "live" : "stale"}"></span><span class="title">${esc(d.label || d.id)}</span><div class="meta">${esc(d.note || "")}</div></div><div class="when">${esc(ago(d.last_seen))}</div></div>`;
  });

  document.getElementById("sessions").innerHTML = rows(board.sessions, (s) => {
    return `<div class="row"><div><span class="dot ${s.alive ? "live" : "stale"}"></span><span class="title">${esc(s.cwd || s.id)}</span><div class="meta">${esc((s.id || "").slice(0, 8))} ${esc(s.agent || "")}</div></div><div class="when">${esc(ago(s.opened))}</div></div>`;
  });

  document.getElementById("claims").innerHTML = rows(board.claims, (c) => {
    const paths = (c.paths || []).join(", ");
    return `<div class="row"><div><span class="title">${esc(c.project || "claim")}</span><div class="meta">${esc(c.note || "")} ${esc(paths)}</div></div><div class="when">${esc(c.session || "")}</div></div>`;
  });

  document.getElementById("pickup").innerHTML = rows(board.pickup, (p) => {
    return `<div class="row"><div><span class="title">${esc(p.title || "")}</span><div class="meta">${esc(p.note || "")}</div></div></div>`;
  });

  document.getElementById("journal").innerHTML = rows(board.journal, (j) => {
    return `<div class="row"><div><span class="title">${esc(j.kind || "note")}</span><div class="meta">${esc(j.message || "")}</div></div><div class="when">${esc(ago(j.ts))}</div></div>`;
  });
}

async function load() {
  const res = await fetch("/api/board", { headers: { accept: "application/json" } });
  if (res.status === 401) {
    location.href = "/login";
    return;
  }
  if (!res.ok) throw new Error("board " + res.status);
  render(await res.json());
}

document.getElementById("refresh").addEventListener("click", () => {
  load().catch((e) => {
    document.getElementById("updated").textContent = String(e);
  });
});

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/login";
});

document.getElementById("stamps").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-device]");
  if (!btn) return;
  const id = btn.getAttribute("data-device");
  const note = window.prompt("Short note for this device (optional)", "") || "";
  const res = await fetch("/api/device", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, label: btn.textContent, note }),
  });
  if (res.ok) load();
});

load().catch((e) => {
  document.getElementById("updated").textContent = String(e);
});
