import { authorizeLeader } from "../netlify/lib/leader-auth.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPhotographerHandler } from "../netlify/lib/photographer.js";
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const id = "12345678-1234-4123-8123-123456789012";
function storage() {
  const data = new Map();
  let revision = 0;
  return {
    data,
    get: async (key) => data.get(key)?.value || null,
    getWithMetadata: async (key) =>
      data.has(key)
        ? {
            data: structuredClone(data.get(key).value),
            etag: data.get(key).etag,
          }
        : null,
    getMetadata: async (key) =>
      data.get(key) ? { metadata: data.get(key).metadata } : null,
    list: async ({ prefix }) => ({
      blobs: [...data.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
    }),
    setJSON: async (key, value, options) => {
      if (
        (data.has(key) && options.onlyIfNew) ||
        (options.onlyIfMatch && data.get(key)?.etag !== options.onlyIfMatch)
      )
        return { modified: false };
      data.set(key, {
        etag: String(++revision),
        value: structuredClone(value),
        metadata: options.metadata,
      });
      return { modified: true };
    },
  };
}
const body = (photos = 4) => ({
  id,
  title: "Réunion au bois",
  date: "2026-10-29",
  photos: Array.from({ length: photos }, () => ({
    name: "souvenir.png",
    data: image,
  })),
});
const req = (value, patrol = 0, extra = {}) =>
  new Request(
    `https://app.test/.netlify/functions/photographer?patrol=${patrol}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body: JSON.stringify(value),
    },
  );
test("anonymous publishing is permanent, patrol-scoped and retry-safe; another deployment can read all photos", async () => {
  const db = storage();
  const handler = createPhotographerHandler({ store: () => db });
  const saved = await handler(req(body()));
  assert.equal(saved.status, 201);
  const event = await saved.json();
  assert.equal(event.photos.length, 4);
  const freshDeploy = createPhotographerHandler({ store: () => db });
  const gallery = await (
    await freshDeploy(
      new Request("https://app.test/.netlify/functions/photographer?patrol=0"),
    )
  ).json();
  assert.equal(gallery.events[0].title, "Réunion au bois");
  assert.equal(
    (
      await (
        await freshDeploy(
          new Request(
            "https://app.test/.netlify/functions/photographer?patrol=1",
          ),
        )
      ).json()
    ).events.length,
    0,
  );
  for (const photo of event.photos) {
    const response = await freshDeploy(
      new Request("https://app.test" + photo.url),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.ok((await response.arrayBuffer()).byteLength > 10);
  }
  assert.equal(
    (await handler(req(body()))).status,
    200,
    "retry does not duplicate the event",
  );
  const changed = { ...body(), title: "Different" };
  assert.equal(
    (await handler(req(changed))).status,
    409,
    "anonymous uploads cannot overwrite an existing event",
  );
  assert.equal(db.data.size, 1);
});
test("the server enforces four photos, real image formats, bounds, dates and same-origin uploads", async () => {
  const db = storage(),
    handler = createPhotographerHandler({ store: () => db });
  for (const invalid of [
    body(5),
    body(0),
    null,
    { ...body(), title: " " },
    { ...body(), date: "2026-02-30" },
    { ...body(), id: "../../secret" },
    { ...body(), photos: [{ data: "data:image/svg+xml;base64,PHN2Zy8+" }] },
    { ...body(), photos: [{ data: "data:image/png;base64,AAAA" }] },
  ])
    assert.equal((await handler(req(invalid))).status, 400);
  assert.equal((await handler(req(body(), 6))).status, 400);
  assert.equal(
    (await handler(req(body(), 0, { Origin: "https://other.test" }))).status,
    403,
  );
  assert.equal(
    (await handler(req(body(), 0, { "Content-Length": "3000000" }))).status,
    413,
  );
  assert.equal(
    (await handler(req({ ...body(), title: "x".repeat(2700000) }))).status,
    413,
  );
  const oversized = Buffer.alloc(451 * 1024);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized);
  assert.equal(
    (
      await handler(
        req({
          ...body(),
          photos: [
            { data: "data:image/png;base64," + oversized.toString("base64") },
          ],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    db.data.size,
    0,
    "invalid submissions never partially save photos",
  );
});
test("gallery errors are explicit and metadata is bounded and paginated", async () => {
  const db = storage(),
    handler = createPhotographerHandler({ store: () => db });
  for (let n = 0; n < 22; n++) {
    const input = {
      ...body(1),
      id: `12345678-1234-4123-8123-${String(n).padStart(12, "0")}`,
    };
    assert.equal((await handler(req(input))).status, 201);
  }
  const first = await (
    await handler(
      new Request("https://app.test/.netlify/functions/photographer?patrol=0"),
    )
  ).json();
  assert.equal(first.events.length, 20);
  assert.equal(first.cursor, "20");
  const next = await (
    await handler(
      new Request(
        "https://app.test/.netlify/functions/photographer?patrol=0&cursor=20",
      ),
    )
  ).json();
  assert.equal(next.events.length, 2);
  assert.equal(next.cursor, null);
  assert.ok(
    Buffer.byteLength(JSON.stringify([...db.data.values()][0].metadata)) < 2000,
  );
  const broken = createPhotographerHandler({
    store: () => {
      throw Error("private service info");
    },
  });
  const response = await broken(req(body()));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private service info"));
});

test("only server-verified admins can delete albums; deletion removes photos and blocks anonymous resurrection", async () => {
  for (const email of ["gsvnsdl2006@gmail.com", "troupeoriongsvn@gmail.com"]) {
    const db = storage();
    const handler = createPhotographerHandler({
      store: () => db,
      authorizeDelete: (request) =>
        authorizeLeader(request, async (_url, options) => {
          assert.equal(
            options.headers.Authorization,
            "Bearer verified-session",
          );
          return Response.json({
            id: "user",
            email,
            email_confirmed_at: "2026-10-29",
          });
        }),
    });
    const event = await (await handler(req(body()))).json();
    const deletion = () =>
      new Request(
        `https://app.test/.netlify/functions/photographer?patrol=0&event=${id}`,
        {
          method: "DELETE",
          headers: { Authorization: "Bearer verified-session" },
        },
      );
    assert.equal((await handler(deletion())).status, 200);
    const stored = db.data.get(`events/0/${id}`).value;
    assert.equal(stored.deleted, true);
    assert.equal(
      stored.photos,
      undefined,
      "the image payload has been removed",
    );
    assert.equal(
      (await handler(new Request("https://app.test" + event.photos[0].url)))
        .status,
      404,
    );
    const gallery = await (
      await handler(
        new Request(
          "https://app.test/.netlify/functions/photographer?patrol=0",
        ),
      )
    ).json();
    assert.equal(gallery.events.length, 0);
    assert.equal(
      (await handler(deletion())).status,
      200,
      "repeated deletion is safe",
    );
    assert.equal(
      (await handler(req(body()))).status,
      409,
      "an old anonymous retry cannot restore deleted photos",
    );
  }
});
test("missing, forged, non-admin and unverified sessions cannot delete photos", async () => {
  for (const scenario of [
    "missing",
    "forged",
    "patrol",
    "unverified",
    "outage",
  ]) {
    const db = storage();
    const handler = createPhotographerHandler({
      store: () => db,
      authorizeDelete: (request) =>
        authorizeLeader(request, async () => {
          if (scenario === "forged") return Response.json({}, { status: 401 });
          if (scenario === "outage") throw Error("unavailable");
          return Response.json({
            id: "user",
            email:
              scenario === "patrol"
                ? "goelandaularge@gmail.com"
                : "gsvnsdl2006@gmail.com",
            email_confirmed_at: scenario === "unverified" ? null : "2026-10-29",
          });
        }),
    });
    await handler(req(body()));
    const response = await handler(
      new Request(
        `https://app.test/.netlify/functions/photographer?patrol=0&event=${id}`,
        {
          method: "DELETE",
          headers: {
            ...(scenario !== "missing"
              ? { Authorization: "Bearer untrusted-token" }
              : {}),
            "X-Email": "gsvnsdl2006@gmail.com",
          },
        },
      ),
    );
    assert.equal(
      response.status,
      scenario === "outage"
        ? 503
        : ["missing", "forged"].includes(scenario)
          ? 401
          : 403,
    );
    assert.equal(db.data.get(`events/0/${id}`).value.photos.length, 4);
  }
});
