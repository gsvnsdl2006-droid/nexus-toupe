import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("member dashboard counts distinct badges and a personalized souvenir PDF downloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page.getByLabel("Prénom et nom").fill("Marc Test");
  await page
    .getByRole("button", { name: "Ajouter un membre", exact: true })
    .click();
  await page.locator(".modal-close").click();
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await page
    .getByLabel("Membre", { exact: true })
    .selectOption({ label: "Marc Test" });
  await expect(page.locator(".progress-dashboard")).toContainText("0 / 93");
  await page.locator(".badge-card").filter({ hasText: "Ami de Dieu" }).click();
  await page
    .getByLabel("Ce que j’ai accompli", { exact: true })
    .fill(
      "J’ai préparé un temps de prière avec ma patrouille. Une expérience qui m’a appris à servir les autres.",
    );
  await page
    .locator(".photo-upload input")
    .setInputFiles({
      name: "souvenir.webp",
      mimeType: "image/webp",
      buffer: await readFile("public/branding/goelands.webp"),
    });
  await page
    .getByRole("button", { name: "Ajouter une réalisation", exact: true })
    .click();
  await page.getByLabel("Marquer comme terminé", { exact: true }).check();
  await expect(
    page.getByLabel("Inclure souvenir.webp", { exact: true }),
  ).toBeChecked();
  const file = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Télécharger mon souvenir PDF", exact: true })
    .click();
  const downloaded = await file;
  expect(downloaded.suggestedFilename()).toBe(
    "Souvenir - Ami de Dieu - Marc Test.pdf",
  );
  const bytes = await readFile(await downloaded.path());
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(10000);
  await downloaded.saveAs("/tmp/nexus-badge-memory.pdf");
  await page.locator(".modal-close").click();
  await expect(page.locator(".progress-dashboard")).toContainText("1 / 93");
  await expect(page.locator(".progress-ring")).toHaveAttribute(
    "aria-label",
    "1 badges terminés sur 93, 1,1 %",
  );
  await page.reload();
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await page
    .getByLabel("Membre", { exact: true })
    .selectOption({ label: "Marc Test" });
  await expect(page.locator(".progress-dashboard")).toContainText("1 / 93");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/nexus-progression-dashboard.png",
    fullPage: true,
  });
});
