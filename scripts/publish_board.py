"""Publish a redacted GrokSync snapshot from ~/.groksync state.

Never send absolute home paths. Override URL/token with env:
  GROKSYNC_URL
  GROKSYNC_WRITE_TOKEN
  GROKSYNC_STATE_DIR  (default ~/.groksync)
"""
from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
STATE = Path(os.environ.get("GROKSYNC_STATE_DIR") or (HOME / ".groksync"))
URL = os.environ.get("GROKSYNC_URL", "").rstrip("/")


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def slug_path(p: str, home: str | None = None) -> str:
    """Redact a path to a slug. Already-slugged ~/... values stay (idempotent)."""
    if not p:
        return ""
    raw = str(p).replace("\\", "/").strip()
    if not raw or ".." in raw or "\x00" in raw:
        return ""
    if raw == "~":
        return "~"
    if raw.startswith("~/"):
        rest = raw[2:].lstrip("/")
        if not rest or ".." in rest:
            return ""
        return ("~/" + rest)[:180]
    home_s = (home if home is not None else str(HOME)).replace("\\", "/").rstrip("/")
    if home_s and raw.lower().startswith(home_s.lower()):
        rel = raw[len(home_s) :].lstrip("/")
        return ("~/" + rel)[:180] if rel else "~"
    name = Path(raw.replace("/", os.sep)).name
    if not name or name in {".", ".."}:
        return ""
    return ("~/" + name)[:180]


def read_token() -> str:
    env = os.environ.get("GROKSYNC_WRITE_TOKEN", "").strip()
    if env:
        return env
    p = STATE / "write_token"
    if p.is_file():
        return p.read_text(encoding="utf-8").strip()
    raise SystemExit("set GROKSYNC_WRITE_TOKEN or ~/.groksync/write_token")


def load_json(name: str, default):
    p = STATE / name
    if not p.is_file():
        return default
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def build() -> dict:
    pickup = load_json("pickup.json", [])
    sessions = load_json("sessions.json", [])
    claims = load_json("claims.json", [])
    journal = load_json("journal.json", [])
    for s in sessions:
        if isinstance(s, dict) and s.get("cwd"):
            s["cwd"] = slug_path(str(s["cwd"]))
    for c in claims:
        if isinstance(c, dict) and c.get("paths"):
            c["paths"] = [slug_path(str(x)) for x in c["paths"]]
    host = os.environ.get("COMPUTERNAME") or os.environ.get("HOSTNAME") or "device"
    return {
        "updated_at": utcnow(),
        "source_host": host,
        "pickup": pickup[:12],
        "sessions": sessions[:20],
        "claims": claims[:20],
        "journal": journal[-12:],
        "devices": {
            "pc": {
                "id": "pc",
                "label": "PC",
                "note": "snapshot",
                "last_seen": utcnow(),
            }
        },
    }


def post(board: dict) -> None:
    if not URL:
        raise SystemExit("set GROKSYNC_URL to your self-hosted origin")
    token = read_token()
    req = urllib.request.Request(
        URL + "/api/snapshot",
        data=json.dumps(board).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "User-Agent": "GrokSync/0.1",
        },
    )
    with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context()) as r:
        print(r.read().decode("utf-8", errors="replace"))


if __name__ == "__main__":
    board = build()
    post(board)
    print("published pickup", len(board["pickup"]), "claims", len(board["claims"]))
