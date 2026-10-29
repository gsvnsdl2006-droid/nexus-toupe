import { test } from "node:test";
import assert from "node:assert/strict";
import { createPatrolSupportHandler } from "../netlify/lib/patrol-support.js";
import { authorizeLeader } from "../netlify/lib/leader-auth.js";
import { supportStore } from "../test-support/support-store.js";
import { incidentWord } from "../src/incident-export.js";
const id = "12345678-1234-4123-8123-123456789012";
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const request = (section, body, patrol = 0, headers = {}) =>
  new Request(
    `https://app.test/.netlify/functions/patrol-support-write?patrol=${patrol}&section=${section}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  );
const list = (section, patrol = 0) =>
  new Request(
    `https://app.test/.netlify/functions/patrol-support?patrol=${patrol}&section=${section}`,
  );
test("public kits persist across deployments and are patrol-scoped; concurrent edits cannot overwrite", async () => {
  const store = supportStore(),
    handler = createPatrolSupportHandler({ store: () => store });
  const kit = {
    id,
    name: "Boîte du camp",
    items: [{ name: "Pansements", quantity: 15, expiry: "2027-01-01" }],
  };
  const created = await handler(request("kit", kit));
  assert.equal(created.status, 201);
  const record = await created.json();
  const fresh = createPatrolSupportHandler({ store: () => store });
  const found = await (await fresh(list("kit"))).json();
  assert.equal(found.records[0].items[0].quantity, 15);
  assert.equal((await (await fresh(list("kit", 1))).json()).records.length, 0);
  assert.equal(
    (
      await handler(
        request("kit", {
          ...kit,
          items: [{ name: "Pansements", quantity: 20, expiry: "" }],
          expectedVersion: record.version,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handler(
        request("kit", {
          ...kit,
          name: "Stale name",
          expectedVersion: record.version,
        }),
      )
    ).status,
    409,
  );
  const large = {
    ...kit,
    id: "22345678-1234-4123-8123-123456789012",
    items: Array.from({ length: 50 }, () => ({
      name: "É".repeat(120),
      quantity: 1,
      expiry: "",
    })),
  };
  assert.equal((await handler(request("kit", large))).status, 201);
  assert.ok(
    Buffer.byteLength(
      JSON.stringify(store.data.get("kit/0/" + large.id).metadata),
    ) < 2000,
  );
});
test("case-study files are shared downloadable attachments and invalid uploads never save", async () => {
  const store = supportStore(),
    handler = createPatrolSupportHandler({ store: () => store });
  const file = {
    name: "Étude de cas.pdf",
    data:
      "data:application/pdf;base64," +
      Buffer.from("%PDF-1.4\nexample").toString("base64"),
  };
  const response = await handler(
    request("cases", { id, name: "Premiers soins", file }),
  );
  assert.equal(response.status, 201);
  const record = await response.json();
  const downloaded = await handler(
    new Request("https://app.test" + record.file.url),
  );
  assert.equal(downloaded.headers.get("Content-Type"), "application/pdf");
  assert.match(downloaded.headers.get("Content-Disposition"), /^attachment;/);
  assert.equal((await downloaded.text()).slice(0, 5), "%PDF-");
  for (const data of [
    "data:text/html;base64,PGgxPkhlbGxvPC9oMT4=",
    "data:image/svg+xml;base64,PHN2Zy8+",
    "data:application/pdf;base64,AAAA",
  ]) {
    assert.equal(
      (
        await handler(
          request("cases", {
            id: "22345678-1234-4123-8123-123456789012",
            name: "Invalid",
            file: { ...file, data },
          }),
        )
      ).status,
      400,
    );
  }
  assert.equal(store.data.size, 1);
  assert.equal(
    (
      await handler(
        request("kit", {
          id,
          name: "Bad",
          items: [{ name: "x", quantity: -1 }],
        }),
      )
    ).status,
    400,
  );
});
test("only the two server-verified admins can add equipment, photos or change quantities", async () => {
  const store = supportStore();
  const equipment = { id, name: "Tente", quantity: 3, image: png };
  for (const email of [
    "gsvnsdl2006@gmail.com",
    "troupeoriongsvn@gmail.com",
    "goelandaularge@gmail.com",
  ]) {
    const handler = createPatrolSupportHandler({
      store: () => store,
      authorizeAdmin: (r) =>
        authorizeLeader(r, async () =>
          Response.json({
            id: "verified-user",
            email,
            email_confirmed_at: "2026-10-30",
          }),
        ),
    });
    if (email === "goelandaularge@gmail.com") {
      assert.equal(
        (
          await handler(
            request("equipment", { ...equipment, quantity: 99 }, 0, {
              Authorization: "Bearer patrol",
              "X-Email": "gsvnsdl2006@gmail.com",
            }),
          )
        ).status,
        403,
      );
      continue;
    }
    const previous = store.data.get("equipment/0/" + id)?.value;
    const result = await handler(
      request(
        "equipment",
        {
          ...equipment,
          quantity: previous ? 5 : 3,
          expectedVersion: previous?.version,
        },
        0,
        { Authorization: "Bearer verified" },
      ),
    );
    assert.ok([200, 201].includes(result.status));
  }
  const publicRead = createPatrolSupportHandler({ store: () => store });
  assert.equal((await publicRead(request("equipment", equipment))).status, 401);
  const equipmentList = await (await publicRead(list("equipment"))).json();
  assert.equal(equipmentList.records[0].quantity, 5);
  const photo = await publicRead(
    new Request("https://app.test" + equipmentList.records[0].photo),
  );
  assert.equal(photo.headers.get("Content-Type"), "image/png");
  assert.ok((await photo.arrayBuffer()).byteLength > 8);
  assert.equal(
    (await (await publicRead(list("equipment", 1))).json()).records.length,
    0,
  );
});
test("incident Word export is a real downloadable document", async () => {
  const blob = await incidentWord(
    {
      event: "Réunion de camp",
      date: "2026-10-30",
      description: "Description du test",
      actions: "Mesures prises",
      followup: "Suivi",
    },
    "Goélands",
  );
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  assert.ok(bytes.length > 1000);
});
