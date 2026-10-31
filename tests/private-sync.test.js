import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergePrivate,
  createPrivateSync,
  SyncConflict,
} from "../src/private-sync.js";
const initial = () => ({
  members: [],
  meetings: [],
  camps: [],
  camp: {},
  transactions: [{ id: "a", amount: 10, description: "Initial" }],
});
test("a refresh during an active sync reads the latest server snapshot afterwards", async () => {
  let record = { revision: 1, payload: initial() };
  let release, entered;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const applying = new Promise((resolve) => {
    entered = resolve;
  });
  let reads = 0, visible;
  const sync = createPrivateSync({
    read: async () => {
      reads++;
      return structuredClone(record);
    },
    write: async () => {
      throw Error("A refresh must not write");
    },
    loadQueue: async () => [],
    storeQueue: async () => {},
    status: () => {},
    apply: async (payload) => {
      visible = payload;
      if (reads === 1) {
        entered();
        await blocked;
      }
    },
  });
  const first = sync.synchronize("Goélands");
  await applying;
  // Older deployed clients may leave the revision unchanged.
  record.payload.members.push({ id: "phone", name: "Saved on phone" });
  const refresh = sync.synchronize("Goélands");
  release();
  await Promise.all([first, refresh]);
  assert.equal(reads, 2);
  assert.equal(visible.members[0].name, "Saved on phone");
});
function engine(server, disk = new Map()) {
  const result = { applied: null, info: null };
  result.sync = createPrivateSync({
    read: async () => {
      if (server.offline) throw Error("offline");
      return structuredClone(server.record);
    },
    write: async (_name, payload, prior) => {
      if (server.offline) throw Error("offline");
      if (server.bump) {
        server.bump();
        server.bump = null;
      }
      if (server.record?.revision !== prior) return null;
      server.record = {
        payload: structuredClone(payload),
        revision: prior + 1,
      };
      if (server.loseAck) {
        server.loseAck = false;
        throw Error("Lost acknowledgement");
      }
      return { revision: prior + 1 };
    },
    loadQueue: async (name) => disk.get(name),
    storeQueue: async (name, queue) => disk.set(name, structuredClone(queue)),
    apply: async (payload) => {
      result.applied = structuredClone(payload);
    },
    status: (_message, info) => {
      result.info = info;
    },
  });
  return result;
}
test("different users’ independent edits merge and deleted transactions do not reappear", async () => {
  const base = initial(),
    server = { record: { payload: structuredClone(base), revision: 1 } };
  const a = engine(server),
    b = engine(server);
  const edited = structuredClone(base);
  edited.transactions[0].amount = 25;
  await a.sync.enqueue("Goélands", base, edited);
  const stale = structuredClone(base);
  stale.transactions.push({ id: "b", amount: 6, description: "Other user" });
  await b.sync.enqueue("Goélands", base, stale);
  assert.equal(server.record.payload.transactions[0].amount, 25);
  assert.equal(server.record.payload.transactions.length, 2);
  const beforeDelete = structuredClone(server.record.payload),
    deleted = structuredClone(beforeDelete);
  deleted.transactions = deleted.transactions.filter((t) => t.id !== "a");
  await a.sync.enqueue("Goélands", beforeDelete, deleted);
  const otherField = structuredClone(beforeDelete);
  otherField.transactions[1].description = "Changed later";
  await b.sync.enqueue("Goélands", beforeDelete, otherField);
  assert.deepEqual(
    server.record.payload.transactions.map((t) => t.id),
    ["b"],
  );
  assert.equal(
    server.record.payload.transactions[0].description,
    "Changed later",
  );
});
test("a revision collision retries instead of dropping the change", async () => {
  const base = initial(),
    server = { record: { payload: base, revision: 1 } };
  server.bump = () => {
    server.record = {
      payload: {
        ...structuredClone(base),
        members: [{ id: "m", name: "New member" }],
      },
      revision: 2,
    };
  };
  const client = engine(server),
    changed = structuredClone(base);
  changed.transactions[0].amount = 30;
  await client.sync.enqueue("Goélands", base, changed);
  assert.equal(server.record.revision, 3);
  assert.equal(server.record.payload.members[0].id, "m");
  assert.equal(server.record.payload.transactions[0].amount, 30);
  assert.equal(client.info.pending, 0);
});
test("failed saves survive a reload, then retry without duplicating transactions", async () => {
  const base = initial(),
    server = {
      offline: true,
      record: { payload: structuredClone(base), revision: 1 },
    },
    disk = new Map();
  const client = engine(server, disk),
    changed = structuredClone(base);
  changed.transactions.push({ id: "new", amount: 12 });
  await client.sync.enqueue("Goélands", base, changed);
  assert.equal(disk.get("Goélands").length, 1);
  assert.equal(client.info.error, true);
  server.offline = false;
  const restarted = engine(server, disk);
  await restarted.sync.synchronize("Goélands");
  await restarted.sync.synchronize("Goélands");
  assert.equal(
    server.record.payload.transactions.filter((t) => t.id === "new").length,
    1,
  );
  assert.equal(disk.get("Goélands").length, 0);
});
test("same-field conflicts keep the local change pending and never overwrite the other user", async () => {
  const base = initial(),
    remote = structuredClone(base),
    mine = structuredClone(base);
  remote.transactions[0].amount = 20;
  mine.transactions[0].amount = 40;
  assert.throws(() => mergePrivate(base, mine, remote), SyncConflict);
  const server = { record: { payload: remote, revision: 2 } },
    client = engine(server);
  await client.sync.enqueue("Goélands", base, mine);
  assert.equal(server.record.payload.transactions[0].amount, 20);
  assert.equal(client.info.conflict, true);
  assert.equal((await client.sync.pending("Goélands")).length, 1);
  await client.sync.discard("Goélands");
  assert.equal(client.applied.transactions[0].amount, 20);
});

test("a lost acknowledgement retries idempotently without duplicating the transaction", async () => {
  const base = initial(),
    server = {
      loseAck: true,
      record: { payload: structuredClone(base), revision: 1 },
    };
  const client = engine(server),
    changed = structuredClone(base);
  changed.transactions.push({ id: "once", amount: 8 });
  await client.sync.enqueue("Goélands", base, changed);
  assert.equal((await client.sync.pending("Goélands")).length, 1);
  await client.sync.synchronize("Goélands");
  assert.equal(
    server.record.payload.transactions.filter((t) => t.id === "once").length,
    1,
  );
  assert.equal(server.record.revision, 2);
  assert.equal(client.info.pending, 0);
});

test("PostgreSQL JSON object key ordering does not turn a saved change into a conflict", () => {
  const before = {
    transactions: [{ id: "a", amount: 10, description: "Old" }],
  };
  const mine = { transactions: [{ id: "a", amount: 10, description: "New" }] };
  const alreadySaved = {
    transactions: [{ description: "New", amount: 10, id: "a" }],
  };
  assert.deepEqual(mergePrivate(before, mine, alreadySaved), mine);
});

test("an edit arriving during acknowledgement backup is saved without waiting for polling", async () => {
  const base = initial();
  let record = { payload: structuredClone(base), revision: 1 };
  let release, entered;
  const applying = new Promise((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  let first = true;
  const sync = createPrivateSync({
    read: async () => structuredClone(record),
    write: async (_name, payload, revision) => {
      record = { payload, revision: revision + 1 };
      return { revision: record.revision };
    },
    loadQueue: async () => [],
    storeQueue: async () => {},
    status: () => {},
    apply: async () => {
      if (first) {
        first = false;
        entered();
        await blocked;
      }
    },
  });
  const refresh = sync.synchronize("Goélands");
  await applying;
  const changed = structuredClone(base);
  changed.members.push({ id: "late-member", name: "Late member" });
  const save = sync.enqueue("Goélands", base, changed);
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  await Promise.all([refresh, save]);
  assert.equal(record.payload.members[0].name, "Late member");
  assert.equal((await sync.pending("Goélands")).length, 0);
});

test("bootstrap publishes legacy local members once and does not resurrect members after later deletion", async () => {
  let record = { revision: 1, payload: initial() };
  let calls = 0;
  const sync = createPrivateSync({
    read: async () => structuredClone(record),
    write: async (_name, payload, revision) => {
      record = { payload, revision: revision + 1 };
      return { revision: record.revision };
    },
    loadQueue: async () => [],
    storeQueue: async () => {},
    apply: async () => {},
    status: () => {},
    bootstrap: async (_name, prior) => {
      calls++;
      return {
        before: prior.payload,
        after: {
          ...prior.payload,
          members: [{ id: "legacy", name: "Legacy member" }],
        },
      };
    },
  });
  await sync.synchronize("Goélands");
  assert.equal(record.payload.members[0].name, "Legacy member");
  assert.equal(record.payload.transactions[0].amount, 10);
  record = { revision: 3, payload: initial() };
  await sync.synchronize("Goélands");
  assert.equal(record.payload.members.length, 0);
  assert.equal(calls, 1);
});

test("a pending transaction conflict never hides shared members or blocks new member saves", async () => {
  const before = initial(),
    remote = structuredClone(before),
    mine = structuredClone(before);
  remote.members = [
    {
      id: "on-server",
      name: "Shared member",
      photo: "data:image/png;base64,shared",
    },
  ];
  remote.transactions[0].amount = 30;
  mine.transactions[0].amount = 20;
  const disk = new Map([["Goélands", [{ before, after: mine }]]]);
  const server = { record: { payload: remote, revision: 4 } };
  const client = engine(server, disk);
  await client.sync.synchronize("Goélands");
  assert.equal(client.applied.members[0].name, "Shared member");
  assert.equal(client.applied.members[0].photo, remote.members[0].photo);
  assert.equal(client.applied.transactions[0].amount, 30);
  assert.equal(client.info.conflict, true);
  assert.equal(client.info.loaded, true);
  const next = structuredClone(client.applied);
  next.members.push({ id: "new-member", name: "New from phone" });
  await client.sync.enqueue("Goélands", client.applied, next);
  assert.equal(server.record.payload.members.length, 2);
  assert.equal(server.record.payload.transactions[0].amount, 30);
  assert.equal((await client.sync.pending("Goélands")).length, 1);
  assert.equal(
    (await client.sync.pending("Goélands"))[0].after.transactions[0].amount,
    20,
  );
});
