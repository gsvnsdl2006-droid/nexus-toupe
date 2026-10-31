import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
test("existing laptop members can be published together without replacing shared records", async ({
  page,
}) => {
  const state = await mock(page, ["Goélands"], {
    email: "gsvnsdl2006@gmail.com",
    payload: {
      members: [{ id: "online", name: "Already online" }],
      transactions: [
        {
          id: "t",
          amount: 25,
          activity: "concours cuisine",
          description: "Keep this transaction",
          type: "in",
          date: "2026-10-28",
        },
      ],
      meetings: [],
      camp: {},
      camps: [],
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page.getByText(/1 membres en ligne/).first()).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open("keyval-store");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise((resolve) => {
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(
        [
          {
            payload: {
              members: [
                { id: "old-copy", name: "Already online" },
                { id: "laptop-a", name: "Laptop member A" },
                { id: "laptop-b", name: "Laptop member B" },
              ],
            },
          },
        ],
        "nexus-private-backup-Goélands",
      );
      tx.oncomplete = resolve;
    });
    db.close();
  });
  await page
    .getByRole("button", {
      name: "Sauvegardes des membres",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("2 membres de cet appareil absents de la base partagée."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Partager 2 membres · Goélands", exact: true })
    .click();
  await expect(
    page.getByText("Enregistrement confirmé dans la base partagée."),
  ).toBeVisible();
  const saved = state.updates.at(-1).payload;
  expect(saved.members.map((m) => m.name)).toEqual([
    "Already online",
    "Laptop member A",
    "Laptop member B",
  ]);
  expect(saved.transactions[0].description).toBe("Keep this transaction");
});

test("a laptop automatically publishes backed-up members into an empty shared roster", async ({
  page,
}) => {
  const state = await mock(page, ["Goélands"], {
    email: "gsvnsdl2006@gmail.com",
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sauvegardes des membres", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("keyval-store");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve) => {
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(
        [
          {
            payload: {
              members: [
                { id: "from-old-laptop", name: "Recovered without retyping" },
              ],
            },
          },
        ],
        "nexus-private-backup-Goélands",
      );
      tx.oncomplete = resolve;
    });
    db.close();
  });
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect
    .poll(() =>
      state.updates.some((r) =>
        r.payload.members.some((m) => m.name === "Recovered without retyping"),
      ),
    )
    .toBe(true);
  await expect(page.getByText(/1 membres en ligne/).first()).toBeVisible();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await expect(page.locator(".member-list")).toContainText(
    "Recovered without retyping",
  );
});
