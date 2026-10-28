import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import JSZip from "jszip";
const photo = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
};
test("member and badge images persist; saved meetings export Word and attendance without Google", async ({
  page,
}) => {
  const external = [];
  page.on("request", (r) => {
    if (/accounts\.google|googleapis/.test(r.url())) external.push(r.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Connecter Drive|Connecter Google/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page.getByLabel("Prénom et nom").fill("Scout Photo");
  await page
    .getByRole("button", { name: "Ajouter un membre", exact: true })
    .click();
  await page
    .getByLabel("Photo de Scout Photo", { exact: true })
    .setInputFiles(photo);
  await expect(page.locator(".avatar img")).toHaveCount(1);
  await page.locator(".modal-close").click();
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await page.locator(".badge-card").filter({ hasText: "Ami de Dieu" }).click();
  await page.getByLabel("Photo du badge", { exact: true }).setInputFiles(photo);
  await expect(page.locator(".badge-photo-editor .uploaded-image")).toHaveCount(
    1,
  );
  await page.locator(".modal-close").click();
  await page.reload();
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  await expect(
    page
      .locator(".badge-card")
      .filter({ hasText: "Ami de Dieu" })
      .locator("img"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await page
    .getByRole("button", { name: "Nouvelle réunion", exact: true })
    .click();
  await page.getByLabel("Titre", { exact: true }).fill("Préparation du camp");
  await page
    .getByLabel("Rapport de la réunion")
    .fill("Nous avons préparé les installations.");
  await page.getByRole("button", { name: "Présent", exact: true }).click();
  await page
    .getByRole("button", { name: "Enregistrer rapport & présences" })
    .click();
  await page.locator(".meeting-card").click();
  let event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Rapport Word", exact: true }).click();
  let download = await event;
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  const xml = await zip.file("word/document.xml").async("string");
  expect(xml).toContain("Scout Photo");
  expect(xml).toContain("préparé les installations");
  event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Présences Excel", exact: true })
    .click();
  download = await event;
  const wb = XLSX.read(await readFile(await download.path()));
  expect(wb.Sheets.Présences.A8.v).toBe("Scout Photo");
  expect(wb.Sheets.Présences.B8.v).toBe("Présent");
  expect(external).toEqual([]);
});
