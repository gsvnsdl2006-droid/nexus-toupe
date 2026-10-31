import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
import { supportStore } from "../test-support/support-store.js";
import { supportApi } from "../test-support/support-route.js";
import { readFile } from "node:fs/promises";
for (const email of [
  "gsvnsdl2006@gmail.com",
  "troupeoriongsvn@gmail.com",
  "goelandaularge@gmail.com",
]) {
  test(`equipment stays publicly editable and shared for ${email}`, async ({
    page,
    browser,
  }) => {
    const store = supportStore(),
      api = supportApi(store, email);
    await mock(page, ["Goélands"], { email });
    await page.route("**/.netlify/functions/patrol-support*", api.route);
    await page.goto("/");
    await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
    await page.getByRole("button", { name: "Intendance", exact: true }).click();
    await page
      .getByRole("button", { name: "Ajouter du matériel", exact: true })
      .click();
    await page
      .getByLabel("Nom du matériel", { exact: true })
      .fill("Tente de patrouille");
    await page.getByLabel("Quantité", { exact: true }).fill("3");
    await page.getByLabel("Photo du matériel", { exact: true }).setInputFiles({
      name: "tente.webp",
      mimeType: "image/webp",
      buffer: await readFile("public/branding/goelands.webp"),
    });
    await expect(page.locator(".support-photo-preview")).toBeVisible();
    await page
      .getByRole("button", { name: "Enregistrer le matériel", exact: true })
      .click();
    await expect(
      page
        .locator(".equipment-card")
        .filter({ hasText: "Tente de patrouille" }),
    ).toContainText("Tente de patrouille");
    await page
      .getByRole("button", {
        name: "Modifier le matériel Tente de patrouille",
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel("Nom du matériel", { exact: true }),
    ).toHaveValue("Tente de patrouille");
    await page.getByLabel("Quantité", { exact: true }).fill("6");
    await page
      .getByRole("button", { name: "Enregistrer le matériel", exact: true })
      .click();
    await expect(
      page
        .locator(".equipment-card")
        .filter({ hasText: "Tente de patrouille" })
        .locator("strong"),
    ).toHaveText("6");
    const fresh = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await fresh.route(
      "**/.netlify/functions/patrol-support*",
      supportApi(store).route,
    );
    const other = await fresh.newPage();
    await other.goto("/");
    await other.getByRole("button", { name: /PATROUILLE 01/ }).click();
    await other
      .getByRole("button", { name: "Intendance", exact: true })
      .click();
    await expect(
      other
        .locator(".equipment-card")
        .filter({ hasText: "Tente de patrouille" })
        .locator("strong"),
    ).toHaveText("6");
    await other
      .locator(".equipment-card")
      .filter({ hasText: "Tente de patrouille" })
      .scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        other
          .locator(".equipment-card")
          .filter({ hasText: "Tente de patrouille" })
          .locator(":scope > img")
          .evaluate((img) => img.naturalWidth > 0),
      )
      .toBe(true);
    await expect(
      other.getByRole("button", {
        name: "Modifier le matériel Tente de patrouille",
        exact: true,
      }),
    ).toBeVisible();
    await fresh.close();
  });
}
