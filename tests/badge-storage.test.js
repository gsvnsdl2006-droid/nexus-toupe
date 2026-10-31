import { test } from "node:test";
import assert from "node:assert/strict";
import { createBadgeHandler } from "../netlify/lib/badge-images.js";
import { authorize } from "../netlify/functions/badge-images.mjs";
const a =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  b = "data:image/jpeg;base64,/9j/AA==";
function memoryStore() {
  const map = new Map();
  let rev = 0;
  return {
    map,
    get: async (key) => map.get(key)?.data ?? null,
    getWithMetadata: async (key) =>
      map.get(key) ? structuredClone(map.get(key)) : null,
    list: async ({ prefix }) => ({
      blobs: [...map.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
    }),
    set: async (key, data, { metadata }) => {
      map.set(key, { data, metadata, etag: String(++rev) });
      return { modified: true };
    },
    setJSON: async (key, data, opts = {}) => {
      const old = map.get(key);
      if (
        (opts.onlyIfNew && old) ||
        (opts.onlyIfMatch && old?.etag !== opts.onlyIfMatch)
      )
        return { modified: false };
      map.set(key, { data, etag: String(++rev), metadata: {} });
      return { modified: true };
    },
  };
}
const request = (image, expectedVersion = null) =>
  new Request("https://app.test/.netlify/functions/badge-images?badge=4", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-session",
    },
    body: JSON.stringify({ image, expectedVersion }),
  });
test("site-wide photo data survives a new handler/deployment and anonymous readers can load it", async () => {
  const store = memoryStore();
  const handler = createBadgeHandler({
    store: () => store,
    authorize: async () => ({ ok: true }),
  });
  const first = await handler(request(a));
  assert.equal(first.status, 200);
  const head = await first.json();
  const afterDeploy = createBadgeHandler({
    store: () => store,
    authorize: async () => ({ ok: true }),
  });
  const manifest = await (
    await afterDeploy(
      new Request("https://app.test/.netlify/functions/badge-images"),
    )
  ).json();
  assert.equal(manifest.images[0].version, head.version);
  const image = await afterDeploy(new Request("https://app.test" + head.url));
  assert.equal(image.headers.get("Content-Type"), "image/png");
  assert.match(image.headers.get("Cache-Control"), /immutable/);
  assert.ok((await image.arrayBuffer()).byteLength > 8);
  const changed = await (await handler(request(b, head.version))).json();
  assert.notEqual(changed.version, head.version);
  assert.equal(
    (await afterDeploy(new Request("https://app.test" + head.url))).status,
    200,
    "previous version remains recoverable",
  );
});
test("a stale local image cannot overwrite another saved image and unauthorized uploads are rejected", async () => {
  const store = memoryStore();
  const handler = createBadgeHandler({
    store: () => store,
    authorize: async () => ({ ok: true }),
  });
  await handler(request(a));
  assert.equal((await handler(request(b))).status, 409);
  assert.equal(store.map.size, 2);
  const denied = createBadgeHandler({
    store: () => store,
    authorize: async () => ({ ok: false, status: 403 }),
  });
  assert.equal((await denied(request(b))).status, 403);
  assert.equal(
    (await handler(request("data:image/svg+xml;base64,PHN2Zz4="))).status,
    400,
  );
});
test("anonymous badge cover edits use the same durable public store", async () => {
  const store = memoryStore();
  const handler = createBadgeHandler({ store: () => store, authorize });
  const response = await handler(new Request("https://app.test/.netlify/functions/badge-images?badge=4", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: a, expectedVersion: null }),
  }));
  assert.equal(response.status, 200);
  const otherDevice = createBadgeHandler({ store: () => store, authorize });
  const listed = await (await otherDevice(new Request("https://app.test/.netlify/functions/badge-images"))).json();
  assert.equal(listed.images.length, 1);
  assert.equal(listed.images[0].badge, 4);
});
