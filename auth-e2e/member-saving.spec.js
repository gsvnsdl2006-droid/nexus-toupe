import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
test("member edits require an authorized session and persist after reopening the app", async ({
  page,
}) => {
  const state = await mock(page, ["Goélands"], {
    email: "goelandaularge@gmail.com",
  });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await expect(
    page.getByRole("button", { name: "Ajouter un membre", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  // OAuth restores the patrol dashboard; reopen the editor.
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page
    .getByPlaceholder("Ex. Marc Haddad")
    .fill("Member saved from laptop");
  await page
    .getByRole("button", { name: "Ajouter un membre", exact: true })
    .click();
  await expect
    .poll(() =>
      state.updates.some((x) =>
        x.payload?.members?.some((m) => m.name === "Member saved from laptop"),
      ),
    )
    .toBe(true);
  await expect(page.locator(".modal")).toContainText(
    "À jour · enregistré et partagé",
  );
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("keyval-store");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(
        [
          {
            payload: {
              members: [
                { id: "recovered-member", name: "Recovered laptop member" },
              ],
            },
          },
        ],
        "nexus-private-backup-Goélands",
      );
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page
    .getByRole("button", {
      name: "Rechercher les membres non synchronisés sur cet appareil",
    })
    .click();
  await page
    .getByRole("button", { name: "Restaurer ce membre", exact: true })
    .click();
  await expect
    .poll(() =>
      state.updates.some((x) =>
        x.payload?.members?.some((m) => m.name === "Recovered laptop member"),
      ),
    )
    .toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await expect(page.locator(".member-list")).toContainText(
    "Member saved from laptop",
  );
  await expect(page.locator(".member-list")).toContainText(
    "Recovered laptop member",
  );
});
