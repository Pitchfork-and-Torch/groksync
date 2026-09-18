import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WRITE_API_PATHS,
  cleanContext,
  emptyBoard,
  mergeSnapshot,
  normalizeDeviceId,
  parseBoard,
  redactBoard,
  slugPath,
} from "../functions/_lib.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function testSlug() {
  assert.equal(slugPath("~/src/my-app"), "~/src/my-app");
  assert.equal(slugPath(slugPath("~/src/my-app")), "~/src/my-app");
  assert.equal(slugPath("C:\\Users\\Example\\secret\\app"), "~/app");
  assert.equal(slugPath("/home/alice/proj"), "~/proj");
  assert.equal(slugPath("../secrets"), "");
  assert.equal(slugPath(""), "");
  assert.equal(slugPath("~"), "~");
}

function testDevice() {
  assert.equal(normalizeDeviceId("pc"), "pc");
  assert.equal(normalizeDeviceId("iPhone"), "phone");
  assert.equal(normalizeDeviceId("grok-bot"), null);
  assert.equal(normalizeDeviceId("laptop"), null);
}

function testMergePreservesContext() {
  const prev = {
    ...emptyBoard(),
    context: {
      project: "my-app",
      note: "keep me",
      next: "ship",
      files: ["src/app.js"],
    },
    pickup: [{ title: "old" }],
  };
  const body = {
    pickup: [{ title: "new leftover" }],
    sessions: [{ id: "abc", cwd: "C:\\Users\\Example\\src\\my-app" }],
    claims: [{ project: "my-app", paths: ["~/src/my-app", "C:\\Users\\Example\\src\\my-app"] }],
    context: null,
    source_host: "DESKTOP-LEAK",
  };
  const next = mergeSnapshot(prev, body, "2026-01-01T00:00:00.000Z");
  assert.equal(next.context.project, "my-app");
  assert.equal(next.context.note, "keep me");
  assert.equal(next.pickup[0].title, "new leftover");
  assert.equal(next.sessions[0].cwd, "~/my-app");
  assert.deepEqual(next.claims[0].paths, ["~/src/my-app", "~/my-app"]);
  assert.equal(next.source_host, "DESKTOP-LEAK");
  assert.equal(next.updated_at, "2026-01-01T00:00:00.000Z");
}

function testMergeIgnoresSnapshotContext() {
  const prev = { ...emptyBoard(), context: { project: "held" } };
  const body = { context: { project: "attacker", note: "wipe" } };
  const next = mergeSnapshot(prev, body, "t");
  assert.equal(next.context.project, "held");
}

function testMergeEmptyListsWin() {
  const prev = {
    ...emptyBoard(),
    pickup: [{ title: "stale leftover" }],
    notes: [{ title: "old", body: "keep?" }],
    devices: { pc: { id: "pc", label: "PC", last_seen: "a" } },
  };
  const body = {
    pickup: [],
    notes: [],
    devices: { mac: { id: "mac", label: "Mac", last_seen: "b" } },
  };
  const next = mergeSnapshot(prev, body, "t");
  assert.deepEqual(next.pickup, []);
  assert.deepEqual(next.notes, []);
  assert.equal(next.devices.pc.label, "PC");
  assert.equal(next.devices.mac.label, "Mac");
}

function testMergeKeepsListsWhenOmitted() {
  const prev = {
    ...emptyBoard(),
    pickup: [{ title: "held leftover" }],
    bots: [{ id: "ops", label: "ops" }],
  };
  const next = mergeSnapshot(prev, { sessions: [] }, "t");
  assert.equal(next.pickup[0].title, "held leftover");
  assert.equal(next.bots[0].id, "ops");
  assert.deepEqual(next.sessions, []);
}

function testRedactBoard() {
  const dirty = {
    updated_at: "stamp",
    sessions: [{ id: "s", cwd: "C:\\Users\\Example\\proj" }],
    claims: [{ project: "p", paths: ["C:\\Users\\Example\\proj"] }],
    context: {
      updated_at: "ctx",
      project: "p",
      files: ["C:\\Users\\Example\\proj\\a.js", "src/ok.js"],
    },
  };
  const out = redactBoard(dirty);
  assert.equal(out.updated_at, "stamp");
  assert.equal(out.sessions[0].cwd, "~/proj");
  assert.equal(out.claims[0].paths[0], "~/proj");
  assert.equal(out.context.updated_at, "ctx");
  assert.ok(!out.context.files.some((f) => /Users|home/i.test(f)));
  assert.ok(out.context.files.includes("src/ok.js"));
  assert.ok(out.context.files.includes("proj/a.js"));
}

function testCleanContextEnc() {
  const ctx = cleanContext(
    { project: "x", note: "secret", next: "n", files: ["a.js"], enc: { v: 1, ct: "x" } },
    "now"
  );
  assert.equal(ctx.note, "");
  assert.equal(ctx.next, "");
  assert.deepEqual(ctx.files, []);
  assert.equal(ctx.enc.v, 1);
  assert.equal(ctx.updated_at, "now");
}

function testParseBoard() {
  assert.deepEqual(parseBoard(null).sessions, []);
  assert.deepEqual(parseBoard("not-json").claims, []);
  assert.equal(parseBoard('{"context":{"project":"a"}}').context.project, "a");
}

function testWritePaths() {
  for (const p of [
    "/api/snapshot",
    "/api/device",
    "/api/board",
    "/api/now",
    "/api/context",
    "/api/handoff",
  ]) {
    assert.ok(WRITE_API_PATHS.has(p), p);
  }
  assert.equal(WRITE_API_PATHS.has("/api/login"), false);
  const mw = readFileSync(join(root, "functions", "_middleware.js"), "utf8");
  assert.ok(mw.includes("WRITE_API_PATHS.has(path)"));
  const handoff = readFileSync(join(root, "functions", "api", "handoff.js"), "utf8");
  assert.equal(handoff.includes("grok-bot"), false);
  // Handoff must redact context like /api/board and /api/now (legacy absolute paths).
  assert.ok(handoff.includes("redactBoard"), "handoff must redactBoard before return");
}

function testHandoffStyleRedact() {
  const dirty = {
    ...emptyBoard(),
    devices: { pc: { id: "pc", label: "PC", note: "", last_seen: "t" } },
    context: {
      updated_at: "ctx",
      project: "p",
      note: "n",
      next: "x",
      files: ["C:\\Users\\Example\\secret.js", "src/ok.js"],
      branch: "main",
      claim: "c",
      source_device: "pc",
    },
  };
  const safe = redactBoard(dirty);
  assert.ok(!safe.context.files.some((f) => /Users|home/i.test(f)));
  assert.ok(safe.context.files.includes("secret.js") || safe.context.files.includes("src/ok.js"));
}


function testPickupPathScrub() {
  const next = mergeSnapshot(emptyBoard(), {
    pickup: [
      { title: "/Users/alice/secret/todo.md", note: "C:\\Users\\bob\\passwords.txt" },
      { title: "Buy milk", note: "normal leftover" },
      { title: "~/src/app", note: "keep slug" },
    ],
  }, "t");
  assert.equal(next.pickup[0].title, "todo.md");
  assert.equal(next.pickup[0].note, "passwords.txt");
  assert.equal(next.pickup[1].title, "Buy milk");
  assert.equal(next.pickup[1].note, "normal leftover");
  assert.equal(next.pickup[2].title, "~/src/app");
  assert.equal(next.pickup[2].note, "keep slug");
  const out = redactBoard({ ...next, updated_at: "t" });
  assert.ok(!out.pickup.some((x) => /Users|home|\\\\/i.test(x.title + x.note)));
}

testSlug();
testDevice();
testMergePreservesContext();
testMergeIgnoresSnapshotContext();
testMergeEmptyListsWin();
testMergeKeepsListsWhenOmitted();
testRedactBoard();
testCleanContextEnc();
testParseBoard();
testWritePaths();
testHandoffStyleRedact();
testPickupPathScrub();
console.log("SYNC ENGINE OK");
