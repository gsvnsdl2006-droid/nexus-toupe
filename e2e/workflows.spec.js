import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { readFile } from "node:fs/promises";
test("patrol workflows persist and remain isolated", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page.getByLabel("Prénom et nom").fill("Marc Test");
  await page.getByRole("button", { name: "Ajouter un membre" }).click();
  await expect(page.locator(".member-list")).toContainText("Marc Test");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.getByRole("button", { name: "Trésorier", exact: true }).click();
  await page.getByRole("button", { name: "Opération", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("Cotisation test");
  await page.getByLabel("Montant", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Enregistrer l’opération" }).click();
  await expect(page.locator("tbody")).toContainText("Cotisation test");
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await page.getByRole("button", { name: "Nouvelle réunion" }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Réunion test");
  await page
    .getByLabel("Rapport de la réunion")
    .fill("Nous avons préparé le camp.");
  await page.getByRole("button", { name: "Présent", exact: true }).click();
  await page
    .getByRole("button", { name: "Enregistrer rapport & présences" })
    .click();
  await page.getByRole("button", { name: "Présences & statistiques" }).click();
  await expect(page.locator("tbody")).toContainText("100 %");
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await page
    .getByLabel("Membre", { exact: true })
    .selectOption({ label: "Marc Test" });
  await page.locator(".badge-card").filter({ hasText: "Ami de Dieu" }).click();
  await page
    .getByLabel("Ce que j’ai accompli")
    .fill("Participation au service de la paroisse.");
  await page
    .locator(".photo-upload input")
    .setInputFiles({
      name: "preuve.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.getByRole("button", { name: "Ajouter une réalisation" }).click();
  await expect(page.locator(".entry-list")).toContainText(
    "Participation au service",
  );
  await expect(page.locator(".entry-list img")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Fermer", exact: true })
    .first()
    .click();
  await page.reload();
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await expect(page.locator(".meeting-list")).toContainText("Réunion test");
  await page
    .getByRole("button", { name: "Dossier de camp", exact: true })
    .click();
  await page.locator(".camp-select").selectOption("4");
  const field = page.getByLabel("5-Objectifs A10", { exact: true });
  await field.fill("Autonomie de la patrouille");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  const file = await downloaded;
  const wb = XLSX.read(await readFile(await file.path()));
  expect(wb.Sheets["5-Objectifs"].A10.v).toBe("Autonomie de la patrouille");
  await page.getByRole("button", { name: "Toutes les patrouilles" }).click();
  await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
  await expect(page.locator(".patrol-title")).toContainText("0");
  expect(errors).toEqual([]);
});
test("mobile landing and patrol navigation fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Une troupe/ })).toBeVisible();
  await expect(page.locator(".patrol-card")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/nexus-mobile.png", fullPage: true });
  await page.getByRole("button", { name: /PATROUILLE 06/ }).click();
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await expect(page.locator(".badge-card")).toHaveCount(97);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
