"""Local claim check. Paths stay on this device (mapper.json)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
STATE = Path(os.environ.get("GROKSYNC_STATE_DIR") or (HOME / ".groksync"))


def mapper() -> dict:
    p = STATE / "mapper.json"
    if not p.is_file():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def check(project: str) -> int:
    maps = mapper()
    rel = maps.get(project)
    if not rel:
        print("no local mapper for project", project)
        return 0
    path = os.path.expanduser(str(rel))
    desk = HOME / ".grok" / "desk" / "desk.py"
    if desk.is_file():
        r = subprocess.run([sys.executable, str(desk), "check", path])
        return int(r.returncode)
    print("local path", path, "(no desk CLI on this machine)")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: groksync_claim_check.py PROJECT")
    raise SystemExit(check(sys.argv[1]))
