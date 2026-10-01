#!/usr/bin/env python3
"""Print the current GrokSync context packet (Cut B)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from groksync_client import request  # noqa: E402


def main() -> None:
    pkt = request("GET", "/api/now")
    ctx = pkt.get("context") or {}
    passphrase = os.environ.get("GROKSYNC_PASSPHRASE", "")
    if ctx.get("enc") and passphrase:
        from groksync_crypto import decrypt_secret

        secret = decrypt_secret(passphrase, ctx["enc"])
        ctx = {**ctx, **secret, "enc": None}
    print(json.dumps({"updated_at": pkt.get("updated_at"), "context": ctx}, indent=2))
    project = (ctx or {}).get("project") or ""
    if project:
        import groksync_claim_check as chk

        chk.check(project)


if __name__ == "__main__":
    main()
