import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mock } from "../test-support/mock-supabase.js";
import { supportStore } from "../test-support/support-store.js";
import { sharedWorkspaceApi } from "../test-support/shared-route.js";
const member = { id: "member-one", name: "Scout Shared" };
const privateRecord = () => ({
  revision: 2,
  payload: {
    members: [member],
    transactions: [],
    meetings: [],
    camp: {},
    camps: [],
    incidents: [],
  },
});
async function connect(page, record) {
  await mock(page, ["Goélands"], {
    email: "gsvnsdl2006@gmail.com",
    payload: record.payload,
  });
  await page.route(
    "https://nexus-access-test.supabase.co/rest/v1/patrol_records**",
    async (route) => {
      const r = route.request();
      const json = (data) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (r.method() === "GET") return json([record]);
      const next = r.postDataJSON();
      const prior = Number(
        new URL(r.url()).searchParams.get("revision")?.replace("eq.", ""),
      );
      if (r.method() === "PATCH" && prior !== record.revision) return json([]);
      record.payload = next.payload;
      record.revision = next.revision;
      return json(
        r.method() === "POST"
          ? { revision: record.revision }
          : [{ revision: record.revision }],
      );
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Trésorier", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Opération", exact: true }),
  ).toBeVisible();
}
async function progression(page) {
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await page.getByLabel("Membre", { exact: true }).selectOption(member.id);
  await page.locator(".badge-card").nth(4).click();
}
test("morning progression, photos, completion and new achievements migrate and sync across laptop and phone", async ({
  browser,
}) => {
  const store = supportStore(),
    api = sharedWorkspaceApi(store),
    shared = privateRecord();
  const contexts = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await page.clock.install();
    await page.route("**/.netlify/functions/shared-workspace*", api);
    contexts.push({ context, page });
  }
  const [laptop, phone] = contexts.map((x) => x.page);
  await laptop.goto("/");
  await expect(
    laptop.getByRole("button", { name: /PATROUILLE 01/ }),
  ).toBeVisible();
  const image = `data:image/png;base64,${(await readFile("public/icons/orion-green-32.png")).toString("base64")}`;
  await laptop.evaluate(
    async ({ member, image }) => {
      const { initial } = await import("/src/model.js");
      const data = initial();
      data.patrols["Goélands"].members = [member];
      data.patrols["Goélands"].progress = [
        {
          id: "morning-entry",
          member: member.id,
          badge: 4,
          date: "2026-10-31",
          text: "Morning achievement was saved only on laptop",
          photos: [{ id: "morning-photo", name: "Proof.png", data: image }],
        },
      ];
      data.patrols["Goélands"].badgeCompletions = {
        [member.id]: { 4: { completed: true, date: "2026-10-31" } },
      };
      const db = await new Promise((resolve) => {
        const r = indexedDB.open("keyval-store");
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise((resolve) => {
        const tx = db.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put(data, "nexus-data");
        tx.oncomplete = resolve;
      });
      db.close();
    },
    { member, image },
  );
  await laptop.reload();
  await expect
    .poll(
      () =>
        store.data.get("documents/progress-0")?.value.payload.progress.length,
    )
    .toBe(1);
  await connect(phone, shared);
  await progression(phone);
  await expect(phone.locator(".entry-list")).toContainText(
    "Morning achievement was saved only on laptop",
  );
  await expect(
    phone.getByLabel("Marquer comme terminé", { exact: true }),
  ).toBeChecked();
  await expect
    .poll(() =>
      phone.locator(".entry-list img").evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await laptop.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await progression(laptop);
  await laptop
    .getByLabel("Ce que j’ai accompli", { exact: true })
    .fill("New achievement shared in real time");
  await laptop
    .getByRole("button", { name: "Ajouter une réalisation", exact: true })
    .click();
  await expect
    .poll(
      () =>
        store.data.get("documents/progress-0")?.value.payload.progress.length,
    )
    .toBe(2);
  await phone.clock.fastForward(10500);
  await expect(phone.locator(".entry-list")).toContainText(
    "New achievement shared in real time",
  );
  await phone.getByLabel("Marquer comme terminé", { exact: true }).uncheck();
  await expect
    .poll(
      () =>
        store.data.get("documents/progress-0")?.value.payload.badgeCompletions[
          member.id
        ][4].completed,
    )
    .toBe(false);
  await laptop.clock.fastForward(10500);
  await expect(
    laptop.getByLabel("Marquer comme terminé", { exact: true }),
  ).not.toBeChecked();
  for (const { context } of contexts) await context.close();
});
test("private incident reports and troop badge catalogue are shared between authorized devices", async ({
  browser,
}) => {
  const store = supportStore(),
    api = sharedWorkspaceApi(store),
    shared = privateRecord(),
    contexts = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await page.clock.install();
    await page.route("**/.netlify/functions/shared-workspace*", api);
    await connect(page, shared);
    contexts.push({ context, page });
  }
  const [laptop, phone] = contexts.map((x) => x.page);
  await laptop.getByRole("button", { name: "Secouriste", exact: true }).click();
  await laptop.getByRole("button", { name: "Incident", exact: true }).click();
  await laptop
    .getByRole("button", { name: "Créer un rapport d’incident", exact: true })
    .click();
  await laptop
    .getByLabel("Événement ou réunion", { exact: true })
    .fill("Shared first-aid event");
  await laptop
    .getByLabel("Description de l’incident", { exact: true })
    .fill("Fictional incident for cross-device validation.");
  await laptop
    .getByRole("button", {
      name: "Enregistrer le rapport en ligne",
      exact: true,
    })
    .click();
  await expect.poll(() => shared.payload.incidents?.length).toBe(1);
  await phone.clock.fastForward(10500);
  await phone.getByRole("button", { name: "Secouriste", exact: true }).click();
  await phone.getByRole("button", { name: "Incident", exact: true }).click();
  await expect(phone.locator(".incident-card")).toContainText(
    "Shared first-aid event",
  );
  await laptop
    .getByRole("button", { name: "Progression", exact: true })
    .click();
  await laptop
    .getByRole("button", { name: "Catalogue des 93 badges", exact: true })
    .click();
  const names = await laptop.locator("textarea[name=badges]").inputValue();
  await laptop.locator("textarea[name=badges]").fill(
    names
      .split("\n")
      .map((n, i) => (i === 0 ? "Badge shared catalogue" : n))
      .join("\n"),
  );
  await laptop
    .getByRole("button", { name: "Enregistrer le catalogue", exact: true })
    .click();
  await expect
    .poll(() => store.data.get("documents/config")?.value.payload.badges[0])
    .toBe("Badge shared catalogue");
  await phone.clock.fastForward(10500);
  await phone.getByRole("button", { name: "Progression", exact: true }).click();
  await expect(phone.locator(".badge-card").nth(4)).toContainText(
    "Badge shared catalogue",
  );
  for (const { context } of contexts) await context.close();
});
