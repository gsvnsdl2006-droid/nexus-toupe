import { test } from "node:test";
import assert from "node:assert/strict";
import { initial } from "../src/model.js";
import { connect, sync, restore, disconnect } from "../src/drive.js";
test("Drive archive creates six independent Sheets pairs, Docs reports, photos and a restorable snapshot", async () => {
  const oldWindow = globalThis.window,
    oldFetch = globalThis.fetch;
  const files = [];
  let id = 0;
  let snapshot;
  globalThis.window = {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (options) => ({
            requestAccessToken: () =>
              options.callback({ access_token: "test-token" }),
          }),
          revoke: () => {},
        },
      },
    },
  };
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith("data:")) return oldFetch(url, options);
    const u = new URL(url);
    if (options.method === "POST" || options.method === "PATCH") {
      if (options.body instanceof FormData) {
        const meta = JSON.parse(await options.body.get("metadata").text());
        const f = { id: String(++id), ...meta };
        if (meta.name === "nexus-backup.json")
          snapshot = JSON.parse(await options.body.get("file").text());
        files.push(f);
        return Response.json(f);
      }
      const f = { id: String(++id), ...JSON.parse(options.body) };
      files.push(f);
      return Response.json(f);
    }
    if (u.searchParams.has("q")) {
      const q = u.searchParams.get("q");
      const name = q.match(/name = '([^']+)'/)?.[1];
      const parent = q.match(/and '([^']+)' in parents/)?.[1];
      return Response.json({
        files: files.filter(
          (f) => f.name === name && (!parent || f.parents?.includes(parent)),
        ),
      });
    }
    if (u.searchParams.get("alt") === "media") return Response.json(snapshot);
    throw Error("Unexpected request " + url);
  };
  try {
    const d = initial();
    d.patrols.Lions.members = [{ id: "member", name: "A & B" }];
    d.patrols.Lions.meetings = [
      {
        id: "meeting",
        title: "Camp <test>",
        date: "2026-10-28",
        summary: "Rapport",
        attendance: { member: "present" },
      },
    ];
    d.patrols.Lions.progress = [
      {
        id: "note",
        member: "member",
        photos: [
          {
            id: "photo",
            name: "proof.png",
            data: "data:image/png;base64,aGVsbG8=",
          },
        ],
      },
    ];
    await connect("test-client");
    await sync(d, async () => new Blob(["test workbook"]));
    assert.equal(
      files.filter(
        (f) => f.mimeType === "application/vnd.google-apps.spreadsheet",
      ).length,
      12,
    );
    assert.equal(
      files.filter((f) => f.mimeType === "application/vnd.google-apps.document")
        .length,
      1,
    );
    assert.equal(
      files.filter((f) => f.name === "note-photo-proof.png").length,
      1,
    );
    assert.deepEqual(await restore(), d);
    const before = files.length;
    await assert.rejects(
      () =>
        sync(d, async () => new Blob(["test"]), {
          expectedRevision: d.updated + 1,
        }),
      (e) => e.code === "CONFLICT",
    );
    assert.equal(
      files.length,
      before,
      "conflicting archive must not upload any files",
    );
    await sync(d, async () => new Blob(["test"]), {
      expectedRevision: d.updated,
      previous: d,
    });
    assert.equal(
      files.length,
      before + 1,
      "unchanged patrols must not re-upload workbooks, reports or photos",
    );
    disconnect();
    await assert.rejects(() => restore(), /Connectez/);
  } finally {
    globalThis.window = oldWindow;
    globalThis.fetch = oldFetch;
  }
});
