#!/usr/bin/env python3
"""Passphrase encrypt/decrypt never ships plaintext note/files/next."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from groksync_crypto import decrypt_secret, encrypt_secret  # noqa: E402

secret = {"note": "do not store this", "next": "continue", "files": ["src/app.js"]}
enc = encrypt_secret("test-pass", secret)
assert enc["v"] == 1
assert enc["alg"] == "A256GCM"
blob = str(enc)
assert "do not store this" not in blob
assert "src/app.js" not in blob
out = decrypt_secret("test-pass", enc)
assert out == secret
try:
    decrypt_secret("wrong", enc)
except Exception:
    print("CRYPTO OK")
else:
    raise SystemExit("decrypt with wrong passphrase must fail")
