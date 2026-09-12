#!/usr/bin/env python3
"""Board packet-file button stays generic (no host names)."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = (root / "js" / "app.js").read_text(encoding="utf-8")
site = (root / "site" / "index.html").read_text(encoding="utf-8")
llms = (root / "site" / "llms.txt").read_text(encoding="utf-8")
assert 'id="packet-file"' in app
assert "groksync-packet.json" in app
assert "jonbailey" not in app.lower()
assert '"softwareVersion": "1.2.0"' in site
assert "og.jpg?v=1.2.0" in site
assert "Version: 1.2.0" in llms
print("PACKET FILE OK")
