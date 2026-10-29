import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
const emails = [
  "gsvnsdl2006@gmail.com",
  "troupeoriongsvn@gmail.com",
  "goelandaularge@gmail.com",
];
test("three authorized accounts share, edit and delete transactions across phone, tablet and laptop", async ({
  browser,
}) => {
  const shared = {
    revision: 1,
    payload: {
      members: [],
      meetings: [],
      camp: {},
      camps: [],
      transactions: [],
    },
    fail: false,
  };
  const sessions = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({
      viewport: [
        { width: 390, height: 844 },
        { width: 820, height: 1180 },
        { width: 1440, height: 900 },
      ][i],
    });
    const page = await context.newPage();
    await page.clock.install();
    await mock(page, ["Goélands"], { email: emails[i] });
    await page.route(
      "https://nexus-access-test.supabase.co/rest/v1/patrol_records**",
      async (route) => {
        const r = route.request(),
          json = (body, status = 200) =>
            route.fulfill({
              status,
              contentType: "application/json",
              body: JSON.stringify(body),
            });
        if (r.method() === "GET")
          return json([{ payload: shared.payload, revision: shared.revision }]);
        if (shared.fail)
          return json({ message: "Network temporarily unavailable" }, 503);
        const prior = Number(
          new URL(r.url()).searchParams.get("revision")?.replace("eq.", ""),
        );
        if (r.method() === "PATCH" && prior !== shared.revision)
          return json([]);
        const next = r.postDataJSON();
        shared.payload = next.payload;
        shared.revision = next.revision;
        return json([{ revision: shared.revision }]);
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
    sessions.push({ page, context });
  }
  const [phone, tablet, laptop] = sessions.map((s) => s.page);
  await phone.getByRole("button", { name: "Opération", exact: true }).click();
  await phone
    .getByLabel("Description", { exact: true })
    .fill("Cotisation partagée");
  await phone.getByLabel("Montant", { exact: true }).fill("25");
  await phone
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await expect.poll(() => shared.payload.transactions.length).toBe(1);
  await tablet
    .getByRole("button", {
      name: "Actualiser les données partagées",
      exact: true,
    })
    .click();
  await expect(tablet.locator("tbody")).toContainText("Cotisation partagée");
  await tablet
    .getByRole("button", {
      name: "Modifier l’opération Cotisation partagée",
      exact: true,
    })
    .click();
  await tablet.getByLabel("Montant", { exact: true }).fill("42");
  await tablet
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await expect.poll(() => shared.payload.transactions[0].amount).toBe(42);
  await laptop.clock.fastForward(15000);
  await expect(laptop.locator("tbody")).toContainText("42");
  laptop.once("dialog", (d) => d.accept());
  await laptop
    .getByRole("button", {
      name: "Supprimer l’opération Cotisation partagée",
      exact: true,
    })
    .click();
  await expect.poll(() => shared.payload.transactions.length).toBe(0);
  await phone.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(phone.locator("tbody tr")).toHaveCount(0);
  // A failed save stays queued through a full reload, then an online event retries it.
  shared.fail = true;
  await phone.getByRole("button", { name: "Opération", exact: true }).click();
  await phone.getByLabel("Description", { exact: true }).fill("À synchroniser");
  await phone.getByLabel("Montant", { exact: true }).fill("9");
  await phone
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await expect(phone.locator(".inline-save-status").first()).toContainText(
    "Modification en attente",
  );
  await phone.reload();
  await phone.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await phone.getByRole("button", { name: "Trésorier", exact: true }).click();
  await expect(phone.locator(".inline-save-status").first()).toContainText(
    "Modification en attente",
  );
  shared.fail = false;
  await phone.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => shared.payload.transactions.length).toBe(1);
  await expect(phone.locator(".inline-save-status").first()).toContainText(
    "À jour",
  );
  for (const { context } of sessions) await context.close();
});
