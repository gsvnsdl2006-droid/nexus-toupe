import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { supportStore } from "../test-support/support-store.js";
import { supportApi } from "../test-support/support-route.js";
test("public first aid kits and case studies are shared; incident drafts stay local and export real Word/PDF", async ({
  page,
  browser,
  context,
}) => {
  const store = supportStore(),
    api = supportApi(store);
  await context.route("**/.netlify/functions/patrol-support*", api.route);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Secouriste", exact: true }).click();
  await page
    .getByRole("button", { name: "Créer une boîte de secours", exact: true })
    .click();
  await page
    .getByLabel("Nom de la boîte", { exact: true })
    .fill("Boîte de camp");
  await page.getByLabel("Article 1", { exact: true }).fill("Pansements");
  await page.getByLabel("Quantité article 1", { exact: true }).fill("12");
  await page
    .getByLabel("Péremption article 1", { exact: true })
    .fill("2028-01-01");
  await page
    .getByRole("button", { name: "Enregistrer la boîte", exact: true })
    .click();
  await expect(page.locator(".support-card")).toContainText("Pansements");
  await page.getByRole("button", { name: "Étude de cas", exact: true }).click();
  await page
    .getByLabel("Titre de l’étude de cas", { exact: true })
    .fill("Entorse — étude");
  const pdfFile = Buffer.from("%PDF-1.4\nCase study test\n%%EOF");
  await page
    .getByLabel("Fichier de l’étude de cas", { exact: true })
    .setInputFiles({
      name: "Etude.pdf",
      mimeType: "application/pdf",
      buffer: pdfFile,
    });
  await page
    .getByRole("button", { name: "Enregistrer l’étude de cas", exact: true })
    .click();
  await expect(page.locator(".case-card")).toContainText("Entorse — étude");
  const attachment = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Télécharger le fichier", exact: true })
    .click();
  expect(await readFile(await (await attachment).path())).toEqual(pdfFile);
  await page.getByRole("button", { name: "Incident", exact: true }).click();
  await page
    .getByRole("button", { name: "Créer un rapport d’incident", exact: true })
    .click();
  await page
    .getByLabel("Événement ou réunion", { exact: true })
    .fill("Réunion du vendredi");
  await page
    .getByLabel("Date de l’incident", { exact: true })
    .fill("2026-10-30");
  await page
    .getByLabel("Description de l’incident", { exact: true })
    .fill(
      "Exemple de rapport pour vérifier les exports. Aucun renseignement réel.",
    );
  await page
    .getByLabel("Mesures prises", { exact: true })
    .fill("Mise au repos et information de la maîtrise.");
  await page
    .getByLabel("Suite à donner", { exact: true })
    .fill("Vérification après la réunion.");
  await page
    .getByRole("button", { name: "Boîte de secours", exact: true })
    .click();
  await page.getByRole("button", { name: "Incident", exact: true }).click();
  await expect(
    page.getByLabel("Événement ou réunion", { exact: true }),
  ).toHaveValue("Réunion du vendredi");
  await page
    .getByRole("button", {
      name: "Enregistrer le rapport sur cet appareil",
      exact: true,
    })
    .click();
  await expect(page.locator(".incident-card")).toContainText(
    "Réunion du vendredi",
  );
  for (const format of ["Word", "PDF"]) {
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `Télécharger ${format}`, exact: true })
      .click();
    const download = await pending,
      bytes = await readFile(await download.path());
    expect(bytes.subarray(0, format === "PDF" ? 4 : 2).toString()).toBe(
      format === "PDF" ? "%PDF" : "PK",
    );
    expect(bytes.length).toBeGreaterThan(1000);
    await download.saveAs(
      `/tmp/nexus-incident.${format === "PDF" ? "pdf" : "docx"}`,
    );
  }
  expect(
    [...store.data.keys()].every((key) => /^(kit|cases)\//.test(key)),
  ).toBe(true);
  const fresh = await browser.newContext({
    viewport: { width: 320, height: 740 },
  });
  await fresh.route("**/.netlify/functions/patrol-support*", api.route);
  const other = await fresh.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await other.getByRole("button", { name: "Secouriste", exact: true }).click();
  await expect(other.locator(".support-card")).toContainText("Boîte de camp");
  for (const width of [320, 820, 1440]) {
    await other.setViewportSize({ width, height: 1000 });
    expect(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await other.setViewportSize({ width: 390, height: 844 });
  await other.getByRole("button", { name: "Incident", exact: true }).click();
  await expect(
    other.getByText("Aucun rapport enregistré sur cet appareil."),
  ).toBeVisible();
  await other.getByRole("button", { name: "Intendance", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "Ajouter du matériel", exact: true }),
  ).toHaveCount(0);
  await expect(
    other.getByText("Aucun matériel enregistré pour cette patrouille."),
  ).toBeVisible();
  await fresh.close();
});
