#!/usr/bin/env python3
"""Set the Continue packet. Optional GROKSYNC_PASSPHRASE encrypts note/files/next."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from groksync_client import request  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True)
    p.add_argument("--note", default="")
    p.add_argument("--next", dest="next_step", default="")
    p.add_argument("--branch", default="")
    p.add_argument("--claim", default="")
    p.add_argument("--device", default="")
    p.add_argument("--file", action="append", default=[])
    args = p.parse_args()
    body = {
        "project": args.project,
        "note": args.note[:240],
        "next": args.next_step[:240],
        "branch": args.branch,
        "claim": args.claim,
        "source_device": args.device,
        "files": args.file,
    }
    passphrase = os.environ.get("GROKSYNC_PASSPHRASE", "")
    if passphrase:
        from groksync_crypto import encrypt_secret

        body["enc"] = encrypt_secret(
            passphrase, {"note": body["note"], "next": body["next"], "files": body["files"]}
        )
        body["note"] = ""
        body["next"] = ""
        body["files"] = []
    out = request("POST", "/api/context", body)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
