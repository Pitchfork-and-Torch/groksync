#!/usr/bin/env python3
"""Stamp a device on the board."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from groksync_client import request  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("device", help="pc|mac|phone|agent")
    p.add_argument("--note", default="")
    p.add_argument("--label", default="")
    args = p.parse_args()
    out = request(
        "POST",
        "/api/device",
        {"id": args.device, "note": args.note, "label": args.label or args.device},
    )
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
