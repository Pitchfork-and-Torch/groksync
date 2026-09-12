#!/usr/bin/env python3
"""Handoff context to this device without dropping the Continue packet."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from groksync_client import request  # noqa: E402
import groksync_claim_check as chk  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("device", help="pc|mac|phone|agent")
    p.add_argument("--note", default="handoff")
    p.add_argument("--label", default="")
    args = p.parse_args()
    out = request(
        "POST",
        "/api/handoff",
        {"id": args.device, "note": args.note, "label": args.label or args.device},
    )
    print(json.dumps(out, indent=2))
    project = ((out.get("context") or {}).get("project")) or ""
    if project:
        chk.check(project)


if __name__ == "__main__":
    main()
