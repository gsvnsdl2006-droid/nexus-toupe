import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
import { supportStore } from "../test-support/support-store.js";
import { supportApi } from "../test-support/support-route.js";
test("imported inventory keeps all 37 original photos, supports admin edits and isolates patrol copies", async ({
  page,
}) => {
  const store = supportStore();
  await mock(page, ["Goélands", "Lions"], { email: "gsvnsdl2006@gmail.com" });
  await page.route(
    "**/.netlify/functions/patrol-support*",
    supportApi(store, "gsvnsdl2006@gmail.com").route,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Intendance", exact: true }).click();
  await expect(page.locator(".equipment-card")).toHaveCount(37);
  await expect(page.locator(".equipment-card svg.equipment-photo")).toHaveCount(
    37,
  );
  await page
    .getByRole("button", { name: "Connexion administrateur", exact: true })
    .click();
  const card = page
    .locator(".equipment-card")
    .filter({ has: page.getByRole("heading", { name: "3en", exact: true }) });
  await expect(card.locator("strong")).toHaveText("2");
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: "/tmp/nexus-imported-material.png" });
  await page
    .getByRole("button", { name: "Modifier le matériel 3en", exact: true })
    .click();
  await expect(page.getByLabel("Quantité", { exact: true })).toHaveValue("2");
  await expect(
    page.locator(".support-form svg.support-photo-preview"),
  ).toBeVisible();
  await page.getByLabel("Quantité", { exact: true }).fill("8");
  await page
    .getByRole("button", { name: "Enregistrer le matériel", exact: true })
    .click();
  await expect(card.locator("strong")).toHaveText("8");
  await expect(card.locator("svg.equipment-photo")).toBeVisible();
  await page
    .getByRole("button", { name: "Modifier le matériel Ficel", exact: true })
    .click();
  await expect(page.getByLabel("Sans quantité", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Quantité", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Enregistrer le matériel", exact: true })
    .click();
  await expect(
    page
      .locator(".equipment-card")
      .filter({
        has: page.getByRole("heading", { name: "Ficel", exact: true }),
      }),
  ).toContainText("Sans quantité");
  await page
    .getByRole("button", { name: "Tableau de bord · Goélands", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toutes les patrouilles", exact: true })
    .click();
  await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
  await page.getByRole("button", { name: "Intendance", exact: true }).click();
  await expect(
    page
      .locator(".equipment-card")
      .filter({ has: page.getByRole("heading", { name: "3en", exact: true }) })
      .locator("strong"),
  ).toHaveText("2");
  await expect(page.locator(".equipment-card")).toHaveCount(37);
});
