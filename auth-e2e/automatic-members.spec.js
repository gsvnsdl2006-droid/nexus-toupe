import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
for (const width of [390, 1440])
  test(`shared members load on reopening without a sync click, even with an old conflicting draft at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const before = {
      members: [],
      meetings: [],
      transactions: [
        {
          id: "t",
          amount: 10,
          activity: "concours cuisine",
          type: "in",
          date: "2026-10-28",
          description: "Old transaction",
        },
      ],
      camp: {},
      camps: [],
    };
    const payload = structuredClone(before);
    payload.members = [
      { id: "shared-member", name: "Automatically visible member" },
    ];
    payload.transactions[0].amount = 30;
    const state = await mock(page, ["Goélands"], {
      email: "gsvnsdl2006@gmail.com",
      payload,
    });
    await page.goto("/");
    await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
    await page.getByRole("button", { name: "Trésorier", exact: true }).click();
    await page
      .getByRole("button", { name: "Continue with Google", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Opération", exact: true }),
    ).toBeVisible();
    await page.evaluate(async (base) => {
      const { initial } = await import("/src/model.js");
      const db = await new Promise((resolve) => {
        const r = indexedDB.open("keyval-store");
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise((resolve) => {
        const tx = db.transaction("keyval", "readwrite");
        const after = structuredClone(base);
        after.transactions[0].amount = 20;
        tx.objectStore("keyval").put(
          [{ before: base, after }],
          "nexus-private-pending:11111111-1111-4111-8111-111111111111:gsvnsdl2006@gmail.com:Goélands",
        );
        tx.objectStore("keyval").put(initial(), "nexus-data");
        tx.oncomplete = resolve;
      });
      db.close();
    }, before);
    // Open the home page in the remembered session: no button, patrol entry,
    // recovery page or manual refresh may be required to show the shared count.
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /PATROUILLE 01/ }),
    ).toContainText("1 membres");
    await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
    await page.getByRole("button", { name: /Gérer les membres/ }).click();
    await expect(page.locator(".member-list")).toContainText(
      "Automatically visible member",
    );
    await page
      .getByPlaceholder("Ex. Marc Haddad")
      .fill("New member despite old draft");
    await page
      .getByRole("button", { name: "Ajouter un membre", exact: true })
      .click();
    await expect
      .poll(() =>
        state.updates.some((r) =>
          r.payload.members.some(
            (m) => m.name === "New member despite old draft",
          ),
        ),
      )
      .toBe(true);
    expect(state.updates.at(-1).payload.transactions[0].amount).toBe(30);
  });
