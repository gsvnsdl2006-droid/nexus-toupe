import { test } from "node:test";
import assert from "node:assert/strict";
import { createSharedWorkspaceHandler } from "../netlify/lib/shared-workspace.js";
import { supportStore } from "../test-support/support-store.js";
import { badges } from "../src/badges.js";
import { readFile } from "node:fs/promises";
const url = "https://nexus.test/.netlify/functions/shared-workspace";
const post = (scope, data, extra = "") =>
  new Request(`${url}?scope=${scope}${extra}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
test("public progression, badge completion and immutable photos survive a new handler and isolate patrols", async () => {
  const db = supportStore(),
    handler = createSharedWorkspaceHandler({ store: () => db });
  const image = `data:image/png;base64,${(await readFile(new URL("../public/icons/orion-green-32.png", import.meta.url))).toString("base64")}`;
  const upload = await handler(post("progress-0", { image }, "&asset=upload"));
  assert.equal(upload.status, 200);
  const { url: photo } = await upload.json();
  const payload = {
    progress: [
      {
        id: "entry",
        member: "member",
        badge: 4,
        date: "2026-10-31",
        text: "Morning badge achievement",
        photos: [{ id: "photo", name: "Photo.png", data: photo }],
      },
    ],
    badgeCompletions: {
      member: { 4: { completed: true, date: "2026-10-31" } },
    },
  };
  let response = await handler(
    post("progress-0", { payload, expectedRevision: null }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 1);
  const redeployed = createSharedWorkspaceHandler({ store: () => db });
  const loaded = await (
    await redeployed(new Request(`${url}?scope=progress-0`))
  ).json();
  assert.deepEqual(loaded.payload, payload);
  assert.equal(
    await (await redeployed(new Request(`${url}?scope=progress-1`))).json(),
    null,
  );
  assert.equal(
    (await redeployed(new Request(`https://nexus.test${photo}`))).headers.get(
      "content-type",
    ),
    "image/png",
  );
  assert.equal(
    (await redeployed(post("progress-0", { payload, expectedRevision: null })))
      .status,
    409,
  );
  const changed = structuredClone(payload);
  changed.badgeCompletions.member[4].completed = false;
  assert.equal(
    (
      await redeployed(
        post("progress-0", { payload: changed, expectedRevision: 1 }),
      )
    ).status,
    200,
  );
});
test("catalogue and logo edits require a server-verified administrator and invalid data is rejected", async () => {
  const db = supportStore(),
    config = { badges, branding: {} };
  const denied = createSharedWorkspaceHandler({
    store: () => db,
    authorizeAdmin: async () => ({ ok: false, status: 403 }),
  });
  assert.equal(
    (await denied(post("config", { payload: config, expectedRevision: null })))
      .status,
    403,
  );
  const allowed = createSharedWorkspaceHandler({
    store: () => db,
    authorizeAdmin: async () => ({ ok: true }),
  });
  assert.equal(
    (await allowed(post("config", { payload: config, expectedRevision: null })))
      .status,
    200,
  );
  assert.equal(
    (
      await allowed(
        post("progress-0", {
          payload: { progress: [{ id: "bad" }], badgeCompletions: {} },
          expectedRevision: null,
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await allowed(
        post(
          "progress-0",
          { image: "data:image/png;base64,ZmFrZQ==" },
          "&asset=upload",
        ),
      )
    ).status,
    400,
  );
});

test("different completion dates on old devices do not block independent achievements", async () => {
  const { mergeWorkspace } = await import("../src/shared-merge.js");
  const base = { progress: [], badgeCompletions: {} };
  const local = {
    progress: [
      { id: "morning-note", member: "member", badge: 4, text: "Morning work" },
    ],
    badgeCompletions: {
      member: { 4: { completed: true, date: "2026-10-31" } },
    },
  };
  const remote = {
    progress: [
      { id: "old-note", member: "member", badge: 4, text: "Previous work" },
    ],
    badgeCompletions: {
      member: { 4: { completed: true, date: "2026-10-30" } },
    },
  };
  const result = mergeWorkspace(base, local, remote);
  assert.equal(result.progress.length, 2);
  assert.equal(result.badgeCompletions.member[4].completed, true);
  assert.equal(result.badgeCompletions.member[4].date, "2026-10-30");
  assert.equal(local.badgeCompletions.member[4].date, "2026-10-31");
});
