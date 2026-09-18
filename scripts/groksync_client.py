"""HTTP client for a self-hosted GrokSync board."""
from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path.home()
STATE = Path(os.environ.get("GROKSYNC_STATE_DIR") or (HOME / ".groksync"))


def base_url() -> str:
    u = os.environ.get("GROKSYNC_URL", "").rstrip("/")
    if u:
        return u
    p = STATE / "url"
    if p.is_file():
        return p.read_text(encoding="utf-8").strip().rstrip("/")
    raise SystemExit("set GROKSYNC_URL or ~/.groksync/url")


def token() -> str:
    env = os.environ.get("GROKSYNC_WRITE_TOKEN", "").strip()
    if env:
        return env
    p = STATE / "write_token"
    if p.is_file():
        return p.read_text(encoding="utf-8").strip()
    raise SystemExit("set GROKSYNC_WRITE_TOKEN or ~/.groksync/write_token")


def request(method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        base_url() + path,
        data=data,
        method=method,
        headers={
            "Authorization": "Bearer " + token(),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "GrokSync/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context()) as r:
            raw = r.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code}: {e.read()[:400]!r}")
