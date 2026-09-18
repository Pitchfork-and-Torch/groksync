#!/usr/bin/env python3
"""Board packet-file button stays generic (no host names). Public copy stays generic."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
app = (root / "js" / "app.js").read_text(encoding="utf-8")
site = (root / "site" / "index.html").read_text(encoding="utf-8")
llms = (root / "site" / "llms.txt").read_text(encoding="utf-8")

assert 'id="packet-file"' in app
assert "groksync-packet.json" in app
assert "jonbailey" not in app.lower()
assert '"softwareVersion": "1.2.1"' in site
assert "og.jpg?v=1.2.1" in site
assert "Version: 1.2.1" in llms

# llms.txt is marketing. No personal host, vendor stack, or secret env names.
llms_l = llms.lower()
assert "jonbailey" not in llms_l
assert "cloudflare" not in llms_l
assert "wrangler" not in llms_l
assert "groksync_" not in llms_l
assert re.search(r"\bkv\b", llms_l) is None

# Visible landing + FAQ JSON-LD: generic self-host copy only.
body = site.split("<body", 1)[1]
body = re.sub(
    r'<script defer src="https://hits\.[^"]+"[^>]*></script>',
    "",
    body,
    flags=re.I,
)
faq_ld = ""
m = re.search(
    r'<script type="application/ld\+json">\s*(\{[^<]*"@type": "FAQPage"[\s\S]*?\})\s*</script>',
    site,
)
if m:
    faq_ld = m.group(1)
public = (body + "\n" + faq_ld).lower()
for needle in (
    "cloudflare",
    "wrangler",
    "groksync.jonbailey",
    "groksync_gate_password",
    "groksync_write_token",
    "you own the kv",
):
    assert needle not in public, needle
assert re.search(r"you own the kv\b", public) is None
assert "self-host" in public or "self-hosted" in public

print("PACKET FILE OK")
print("GENERIC COPY OK")
