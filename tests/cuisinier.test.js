import test from "node:test";
import assert from "node:assert/strict";
import { createCuisinierHandler } from "../netlify/lib/cuisinier.js";
import { authorizeLeader } from "../netlify/lib/leader-auth.js";
import { supportStore } from "../test-support/support-store.js";

const recipe = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Riz au camp",
  ingredients: "Riz\nEau",
  instructions: "Faire cuire le riz.",
};
const experience = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Goélands",
  experience: "Très bon après la randonnée !",
  image: "data:image/jpeg;base64,/9j/AA==",
};
const call = (
  handler,
  patrol = 0,
  id = null,
  input = null,
  token = null,
  extra = "",
) =>
  handler(
    new Request(
      `https://nexus.example/.netlify/functions/cuisinier?patrol=${patrol}${id ? `&recipe=${id}` : ""}${extra}`,
      {
        method: input ? "POST" : "GET",
        headers: {
          ...(input ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(input ? { body: JSON.stringify(input) } : {}),
      },
    ),
  );

test("only the two confirmed main admins can create recipes; public experiences cannot replace recipes", async () => {
  const store = supportStore();
  const handler = createCuisinierHandler({
    store: () => store,
    authorize: (request) =>
      authorizeLeader(request, async () => {
        const token = request.headers.get("authorization").slice(7);
        return Response.json({
          id: "verified",
          email:
            token === "patrol"
              ? "goelandaularge@gmail.com"
              : token === "unconfirmed"
                ? "gsvnsdl2006@gmail.com"
                : token,
          email_confirmed_at: token === "unconfirmed" ? null : "2026-01-01",
        });
      }),
  });
  assert.equal((await call(handler, 0, null, recipe)).status, 401);
  assert.equal((await call(handler, 0, null, recipe, "patrol")).status, 403);
  assert.equal(
    (await call(handler, 0, null, recipe, "unconfirmed")).status,
    403,
  );
  for (const [index, email] of [
    "gsvnsdl2006@gmail.com",
    "troupeoriongsvn@gmail.com",
  ].entries()) {
    assert.equal((await call(handler, index, null, recipe, email)).status, 201);
  }
  assert.equal((await call(handler, 0, recipe.id, experience)).status, 201);
  assert.equal(
    (await call(handler, 0, null, { ...recipe, title: "Overwritten" })).status,
    401,
  );
  assert.equal(
    (
      await call(
        handler,
        0,
        null,
        { ...recipe, title: "Overwritten" },
        "gsvnsdl2006@gmail.com",
      )
    ).status,
    409,
  );
  assert.equal(
    (await (await call(handler)).json()).records[0].title,
    recipe.title,
  );
});

test("recipes, experiences and photos persist across handlers, isolate patrols and retry without duplicates", async () => {
  const store = supportStore();
  const admin = createCuisinierHandler({
    store: () => store,
    authorize: async () => ({ ok: true }),
  });
  await call(admin, 0, null, recipe);
  assert.equal((await call(admin, 0, null, recipe)).status, 200);
  assert.equal((await call(admin, 0, recipe.id, experience)).status, 201);
  const fresh = createCuisinierHandler({ store: () => store });
  assert.equal((await call(fresh, 0, recipe.id, experience)).status, 200);
  const list = await (await call(fresh, 0, recipe.id)).json();
  assert.equal(list.records.length, 1);
  assert.equal(list.records[0].experience, experience.experience);
  assert.equal(list.records[0].image, undefined);
  assert.equal(list.records[0].fingerprint, undefined);
  const photo = await fresh(
    new Request(`https://nexus.example${list.records[0].photo}`),
  );
  assert.equal(photo.headers.get("Content-Type"), "image/jpeg");
  assert.deepEqual(
    Buffer.from(await photo.arrayBuffer()),
    Buffer.from([255, 216, 255, 0]),
  );
  assert.equal((await (await call(fresh, 1)).json()).records.length, 0);
  assert.equal((await call(fresh, 1, recipe.id, experience)).status, 404);
  assert.equal(
    (
      await call(fresh, 0, recipe.id, {
        ...experience,
        experience: "Replacement",
      })
    ).status,
    409,
  );
});

test("invalid uploads, unknown recipes, cross-origin writes and invalid records are refused", async () => {
  const store = supportStore(),
    handler = createCuisinierHandler({
      store: () => store,
      authorize: async () => ({ ok: true }),
    });
  await call(handler, 0, null, recipe);
  for (const invalid of [
    { ...experience, image: "data:image/jpeg;base64,aHRtbA==" },
    { ...experience, experience: "", image: "" },
    { ...experience, experience: "x".repeat(5001) },
    { ...experience, name: 42 },
    { ...experience, id: "../invalid" },
    {
      ...experience,
      image: `data:image/jpeg;base64,${Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(451 * 1024)]).toString("base64")}`,
    },
  ])
    assert.equal((await call(handler, 0, recipe.id, invalid)).status, 400);
  assert.equal((await call(handler, 0, experience.id, experience)).status, 404);
  assert.equal((await call(handler, 8, null, recipe)).status, 400);
  assert.equal(
    (await call(handler, 0, null, { ...recipe, ingredients: "" })).status,
    400,
  );
  const crossOrigin = new Request(
    "https://nexus.example/.netlify/functions/cuisinier?patrol=0",
    {
      method: "POST",
      headers: { Origin: "https://other.example" },
      body: JSON.stringify(recipe),
    },
  );
  assert.equal((await handler(crossOrigin)).status, 403);
  assert.equal(
    (
      await handler(
        new Request(
          "https://nexus.example/.netlify/functions/cuisinier?patrol=0",
          { method: "DELETE" },
        ),
      )
    ).status,
    405,
  );
  assert.equal(store.data.size, 1);
});
