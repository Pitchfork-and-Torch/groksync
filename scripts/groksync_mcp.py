#!/usr/bin/env python3
"""Stdio MCP for GrokSync: now, stamp, handoff, set_context."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from groksync_client import request  # noqa: E402
import groksync_claim_check as chk  # noqa: E402


TOOLS = [
    {
        "name": "groksync_now",
        "description": "Pull the current GrokSync continue packet (last project and note).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "groksync_stamp",
        "description": "Stamp which device you are on.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "device": {"type": "string"},
                "note": {"type": "string"},
            },
            "required": ["device"],
        },
    },
    {
        "name": "groksync_handoff",
        "description": "Handoff continue-packet to this device, then local claim check.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "device": {"type": "string"},
                "note": {"type": "string"},
            },
            "required": ["device"],
        },
    },
    {
        "name": "groksync_set_context",
        "description": "Set the continue packet (project + note). Paths must be slugs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string"},
                "note": {"type": "string"},
                "next": {"type": "string"},
                "device": {"type": "string"},
            },
            "required": ["project"],
        },
    },
]


def handle(name: str, args: dict) -> str:
    if name == "groksync_now":
        pkt = request("GET", "/api/now")
        ctx = pkt.get("context") or {}
        if ctx.get("project"):
            chk.check(ctx["project"])
        return json.dumps(pkt, indent=2)
    if name == "groksync_stamp":
        return json.dumps(
            request(
                "POST",
                "/api/device",
                {
                    "id": args.get("device"),
                    "note": args.get("note") or "",
                    "label": args.get("device"),
                },
            ),
            indent=2,
        )
    if name == "groksync_handoff":
        out = request(
            "POST",
            "/api/handoff",
            {
                "id": args.get("device"),
                "note": args.get("note") or "handoff",
                "label": args.get("device"),
            },
        )
        proj = ((out.get("context") or {}).get("project")) or ""
        if proj:
            chk.check(proj)
        return json.dumps(out, indent=2)
    if name == "groksync_set_context":
        return json.dumps(
            request(
                "POST",
                "/api/context",
                {
                    "project": args.get("project"),
                    "note": (args.get("note") or "")[:240],
                    "next": (args.get("next") or "")[:240],
                    "source_device": args.get("device") or "",
                    "files": [],
                },
            ),
            indent=2,
        )
    raise ValueError("unknown tool")


def reply(msg_id, result=None, error=None):
    body = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        body["error"] = {"code": -32000, "message": str(error)}
    else:
        body["result"] = result
    sys.stdout.write(json.dumps(body) + "\n")
    sys.stdout.flush()


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = json.loads(line)
        mid = msg.get("id")
        method = msg.get("method")
        params = msg.get("params") or {}
        try:
            if method == "initialize":
                reply(
                    mid,
                    {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "groksync", "version": "1.0.0"},
                    },
                )
            elif method == "tools/list":
                reply(mid, {"tools": TOOLS})
            elif method == "tools/call":
                name = params.get("name")
                args = params.get("arguments") or {}
                text = handle(name, args)
                reply(mid, {"content": [{"type": "text", "text": text}]})
            elif method == "notifications/initialized":
                continue
            else:
                reply(mid, error=f"unknown method {method}")
        except Exception as e:
            reply(mid, error=str(e))


if __name__ == "__main__":
    main()
