#!/usr/bin/env python3
"""Publisher slug_path is idempotent and does not destroy ~/ slugs."""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import publish_board as pb  # noqa: E402


def test_slug_idempotent() -> None:
    home = r"C:\Users\Example"
    already = "~/src/my-app"
    assert pb.slug_path(already, home=home) == already
    assert pb.slug_path(pb.slug_path(already, home=home), home=home) == already
    under = home + r"\src\my-app"
    assert pb.slug_path(under, home=home) == "~/src/my-app"
    assert pb.slug_path(pb.slug_path(under, home=home), home=home) == "~/src/my-app"
    other = r"D:\other\proj"
    assert pb.slug_path(other, home=home) == "~/proj"
    assert pb.slug_path("", home=home) == ""
    assert pb.slug_path(r"..\secrets", home=home) == ""
    assert pb.slug_path("~", home=home) == "~"


def test_build_keeps_example_slugs() -> None:
    example = Path(__file__).resolve().parent / "example_state"
    old_state = os.environ.get("GROKSYNC_STATE_DIR")
    os.environ["GROKSYNC_STATE_DIR"] = str(example)
    pb.STATE = Path(example)
    try:
        board = pb.build()
    finally:
        if old_state is None:
            os.environ.pop("GROKSYNC_STATE_DIR", None)
        else:
            os.environ["GROKSYNC_STATE_DIR"] = old_state
        pb.STATE = Path(os.environ.get("GROKSYNC_STATE_DIR") or (Path.home() / ".groksync"))
    claims = board["claims"]
    assert claims, "example claims missing"
    assert claims[0]["paths"] == ["~/src/my-app"], claims[0]["paths"]
    assert "context" not in board, "snapshot payload must omit continue packet"


def test_build_redacts_home(tmp_path: Path | None = None) -> None:
    home = Path.home()
    with tempfile.TemporaryDirectory() as td:
        state = Path(td)
        abs_cwd = str(home / "secret-tree" / "app")
        (state / "sessions.json").write_text(
            json.dumps([{"id": "s1", "cwd": abs_cwd, "alive": True}]),
            encoding="utf-8",
        )
        (state / "claims.json").write_text(
            json.dumps([{"project": "app", "paths": [abs_cwd, "~/keep/me"]}]),
            encoding="utf-8",
        )
        old = os.environ.get("GROKSYNC_STATE_DIR")
        os.environ["GROKSYNC_STATE_DIR"] = str(state)
        pb.STATE = state
        try:
            board = pb.build()
        finally:
            if old is None:
                os.environ.pop("GROKSYNC_STATE_DIR", None)
            else:
                os.environ["GROKSYNC_STATE_DIR"] = old
            pb.STATE = Path(os.environ.get("GROKSYNC_STATE_DIR") or (Path.home() / ".groksync"))
        cwd = board["sessions"][0]["cwd"]
        assert cwd.startswith("~/"), cwd
        assert str(home) not in cwd
        assert "Users\\" not in cwd and "/Users/" not in cwd
        paths = board["claims"][0]["paths"]
        assert paths[1] == "~/keep/me"
        assert not any(str(home) in p for p in paths)


if __name__ == "__main__":
    test_slug_idempotent()
    test_build_keeps_example_slugs()
    test_build_redacts_home()
    print("PUBLISH BOARD OK")
