"""AES-GCM for note/files/next. Passphrase never sent to the server."""
from __future__ import annotations

import base64
import json
import os
from typing import Any

ITER = 100_000


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _unb64(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))


def encrypt_secret(passphrase: str, obj: dict[str, Any]) -> dict[str, Any]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes

    salt = os.urandom(16)
    iv = os.urandom(12)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER)
    key = kdf.derive(passphrase.encode("utf-8"))
    ct = AESGCM(key).encrypt(iv, json.dumps(obj).encode("utf-8"), None)
    return {
        "v": 1,
        "alg": "A256GCM",
        "kdf": "PBKDF2-SHA256",
        "iter": ITER,
        "salt": _b64(salt),
        "iv": _b64(iv),
        "ct": _b64(ct),
    }


def decrypt_secret(passphrase: str, enc: dict[str, Any]) -> dict[str, Any]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes

    if not enc or enc.get("v") != 1:
        raise ValueError("bad enc")
    salt = _unb64(enc["salt"])
    iv = _unb64(enc["iv"])
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=int(enc.get("iter") or ITER),
    )
    key = kdf.derive(passphrase.encode("utf-8"))
    pt = AESGCM(key).decrypt(iv, _unb64(enc["ct"]), None)
    return json.loads(pt.decode("utf-8"))
