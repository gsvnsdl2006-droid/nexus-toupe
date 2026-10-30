import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
test("laptop members and photos reach a separate phone, including wake-up and failed-save retry", async ({
  browser,
}) => {
  const shared = {
    revision: 1,
    payload: {
      members: [],
      meetings: [],
      transactions: [],
      camp: {},
      camps: [],
    },
    fail: false,
  };
  const sessions = [];
  for (const [i, email] of [
    "gsvnsdl2006@gmail.com",
    "goelandaularge@gmail.com",
  ].entries()) {
    const context = await browser.newContext({
      viewport: i ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.clock.install();
    await mock(page, ["Goélands"], { email });
    await page.route(
      "https://nexus-access-test.supabase.co/rest/v1/patrol_records**",
      async (route) => {
        const request = route.request();
        const json = (body, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (request.method() === "GET")
          return json([{ payload: shared.payload, revision: shared.revision }]);
        if (shared.fail)
          return json({ message: "Temporary connection failure" }, 503);
        const prior = Number(
          new URL(request.url()).searchParams
            .get("revision")
            ?.replace("eq.", ""),
        );
        if (prior !== shared.revision) return json([]);
        const update = request.postDataJSON();
        shared.payload = update.payload;
        shared.revision = update.revision;
        return json([{ revision: shared.revision }]);
      },
    );
    await page.goto("/");
    await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
    await page.getByRole("button", { name: /Gérer les membres/ }).click();
    await page
      .getByRole("button", { name: "Continue with Google", exact: true })
      .click();
    await page.getByRole("button", { name: /Gérer les membres/ }).click();
    await expect(page.getByPlaceholder("Ex. Marc Haddad")).toBeVisible();
    sessions.push({ context, page });
  }
  const [laptop, phone] = sessions.map((s) => s.page);
  await laptop.getByPlaceholder("Ex. Marc Haddad").fill("Shared member");
  await laptop
    .getByRole("button", { name: "Ajouter un membre", exact: true })
    .click();
  await expect.poll(() => shared.payload.members.length).toBe(1);
  await laptop
    .getByLabel("Photo de Shared member", { exact: true })
    .setInputFiles("public/icons/orion-green-32.png");
  await expect.poll(() => Boolean(shared.payload.members[0].photo)).toBe(true);
  await phone.clock.fastForward(5500);
  await expect(phone.locator(".member-list")).toContainText("Shared member");
  await expect(phone.locator(".member-list .avatar img")).toHaveAttribute(
    "src",
    shared.payload.members[0].photo,
  );
  // Reverse direction: phone writes, laptop reads. A failed write must stay queued.
  shared.fail = true;
  await phone
    .getByPlaceholder("Ex. Marc Haddad")
    .fill("Member queued on phone");
  await phone
    .getByRole("button", { name: "Ajouter un membre", exact: true })
    .click();
  await expect(phone.locator(".modal")).toContainText(
    "Modification en attente",
  );
  expect(shared.payload.members.length).toBe(1);
  shared.fail = false;
  await phone.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect.poll(() => shared.payload.members.length).toBe(2);
  await laptop.clock.fastForward(5500);
  await expect(laptop.locator(".member-list")).toContainText(
    "Member queued on phone",
  );
  for (const { context } of sessions) await context.close();
});

test("a phone retries its initial shared-data connection after coming back online", async ({
  page,
}) => {
  let blocked = true;
  await mock(page, ["Goélands"], {
    email: "goelandaularge@gmail.com",
    payload: {
      members: [{ id: "shared-from-laptop", name: "Already saved on laptop" }],
      meetings: [],
      transactions: [],
      camp: {},
      camps: [],
    },
  });
  await page.route(
    "https://nexus-access-test.supabase.co/rest/v1/patrol_access**",
    async (route) => {
      if (blocked)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Network unavailable" }),
        });
      return route.fallback();
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await expect(
    page.getByRole("button", { name: "Ajouter un membre", exact: true }),
  ).toHaveCount(0);
  blocked = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".member-list")).toContainText(
    "Already saved on laptop",
  );
});
