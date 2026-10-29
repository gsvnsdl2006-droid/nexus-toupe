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
  await expect(page.locator(".attendance-ring")).toHaveAttribute(
    "aria-label",
    "100 % de présence dans la patrouille",
  );
  await expect(page.locator(".member-attendance-charts")).toContainText(
    "Marc Test",
  );
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await page
    .getByLabel("Membre", { exact: true })
    .selectOption({ label: "Marc Test" });
  await page.locator(".badge-card").filter({ hasText: "Ami de Dieu" }).click();
  await page
    .getByLabel("Ce que j’ai accompli")
    .fill("Participation au service de la paroisse.");
  await page.locator(".photo-upload input").setInputFiles({
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
  await page
    .getByRole("button", { name: "Nouveau dossier", exact: true })
    .click();
  await page.getByLabel("Nom du dossier", { exact: true }).fill("Camp de Noël");
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  await page
    .locator(".camp-categories button")
    .filter({ hasText: "Objectifs" })
    .click();
  await page
    .getByLabel("Nos objectifs", { exact: true })
    .fill("Autonomie de la patrouille");
  await page
    .getByRole("button", { name: "Enregistrer la catégorie", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Télécharger Excel", exact: true })
    .click();
  const file = await downloaded;
  const wb = XLSX.read(await readFile(await file.path()));
  expect(wb.Sheets["Objectifs"].B5.v).toBe("Autonomie de la patrouille");
  expect(wb.SheetNames).toHaveLength(10);
  await page
    .getByRole("button", { name: "Tableau de bord · Goélands", exact: true })
    .click();
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
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(
    page.getByRole("img", { name: "Logo Nexus", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Logo Troupe Orion", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await page
    .getByRole("button", { name: "Dossier de camp", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau dossier", exact: true })
    .click();
  await page.getByLabel("Nom du dossier", { exact: true }).fill("Camp mobile");
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  await page
    .locator(".camp-categories button")
    .filter({ hasText: "Objectifs" })
    .click();
  await page
    .getByLabel("Nos objectifs", { exact: true })
    .fill("Autonomie sur mobile");
  await page
    .getByRole("button", { name: "Enregistrer la catégorie", exact: true })
    .click();
  const dock = await page.locator(".mobile-dock").boundingBox();
  expect(dock.y + dock.height).toBeLessThanOrEqual(741);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Back returns to the selected patrol dashboard before leaving the patrol", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
  for (const section of [
    "Trésorier",
    "Secrétariat",
    "Progression",
    "Codes",
    "Photographe",
  ]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await page
      .getByRole("button", { name: "Tableau de bord · Lions", exact: true })
      .click();
    await expect(page.locator(".workspace-grid")).toBeVisible();
    await expect(page.locator(".patrol-title")).toContainText("Lions");
    await expect(page.locator(".patrol-card")).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Toutes les patrouilles", exact: true })
    .click();
  await expect(page.locator(".patrol-card")).toHaveCount(6);
});
test("browser Back and Forward retain the patrol navigation hierarchy", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 04/ }).click();
  await page.getByRole("button", { name: "Trésorier", exact: true }).click();
  await page.goBack();
  await expect(page.locator(".workspace-grid")).toBeVisible();
  await expect(page.locator(".patrol-title")).toContainText("Orcs");
  await page.goBack();
  await expect(page.locator(".patrol-card")).toHaveCount(6);
  await page.goForward();
  await expect(page.locator(".workspace-grid")).toBeVisible();
  await expect(page.locator(".patrol-title")).toContainText("Orcs");
});

test("every transaction has visible edit and delete buttons under its description at all device widths", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Trésorier", exact: true }).click();
  for (const description of [
    "Cotisation de patrouille",
    "Achat de matériel pour la prochaine réunion",
  ]) {
    await page.getByRole("button", { name: "Opération", exact: true }).click();
    await page.getByLabel("Description", { exact: true }).fill(description);
    await page.getByLabel("Montant", { exact: true }).fill("12");
    await page
      .getByRole("button", { name: "Enregistrer l’opération", exact: true })
      .click();
  }
  for (const width of [320, 390, 768, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const row of await page.locator(".treasury-table tbody tr").all()) {
      for (const label of [/Modifier l’opération/, /Supprimer l’opération/]) {
        const button = row.getByRole("button", { name: label });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
  }
  await page
    .getByRole("button", {
      name: "Modifier l’opération Cotisation de patrouille",
      exact: true,
    })
    .click();
  await page.getByLabel("Montant", { exact: true }).fill("18");
  await page
    .getByRole("button", { name: "Enregistrer l’opération", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Supprimer l’opération Cotisation de patrouille",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".treasury-table tbody tr")).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Supprimer l’opération Cotisation de patrouille",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Confirmer la suppression", exact: true })
    .click();
  await expect(page.locator(".treasury-table tbody tr")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Trésorier", exact: true }).click();
  await expect(page.locator(".treasury-table tbody tr")).toHaveCount(1);
});
