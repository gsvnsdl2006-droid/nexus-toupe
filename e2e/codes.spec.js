import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("Codes matches Nexus AI: instant transforms, custom keys, decoding, mapping, copy and text download", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: /Atelier des codes Morse/ }).click();
  await expect(
    page.getByRole("heading", { name: "Atelier des codes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Phrase à coder", { exact: true }).fill("SOS 123?");
  await expect(page.getByLabel("Résultat", { exact: true })).toHaveValue(
    "... --- ... / .---- ..--- ...-- ..--..",
  );
  await expect(page.locator(".cipher-mapping")).toContainText(".-");
  await page.getByRole("button", { name: /Alphabet numéroté/ }).click();
  await page.getByLabel("Lettre de départ", { exact: true }).selectOption("C");
  await page.getByLabel("Nombre (1–26)", { exact: true }).fill("9");
  await page.getByLabel("Phrase à coder", { exact: true }).fill("CD TU");
  await expect(page.getByLabel("Résultat", { exact: true })).toHaveValue(
    "9 10 / 26 1",
  );
  await expect(
    page.locator(".cipher-mapping>div").filter({ hasText: /^C=9$/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Copier", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("9 10 / 26 1");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Télécharger le texte", exact: true })
    .click();
  const file = await downloaded;
  expect(await readFile(await file.path(), "utf8")).toBe("9 10 / 26 1");
  await page.getByRole("button", { name: "Décoder", exact: true }).click();
  await page.getByLabel("Code à décoder", { exact: true }).fill("9 10 / 26 1");
  await expect(page.getByLabel("Résultat", { exact: true })).toHaveValue(
    "CD TU",
  );
  await page.getByRole("button", { name: "Coder", exact: true }).click();
  await page.getByRole("button", { name: /Substitution de lettres/ }).click();
  await page.getByLabel("Lettre de départ", { exact: true }).selectOption("A");
  await page.getByLabel("Lettre d’arrivée", { exact: true }).selectOption("K");
  await page.getByLabel("Phrase à coder", { exact: true }).fill("ABC XYZ");
  await expect(page.getByLabel("Résultat", { exact: true })).toHaveValue(
    "KLM HIJ",
  );
  await page.getByRole("button", { name: /Alphabet inversé/ }).click();
  await expect(page.getByLabel("Résultat", { exact: true })).toHaveValue(
    "ZYX CBA",
  );
  await page
    .getByRole("button", { name: "Toutes les patrouilles", exact: true })
    .click();
  await expect(page.locator(".patrol-card")).toHaveCount(6);
  await page.getByRole("button", { name: /Atelier des codes Morse/ }).click();
  await expect(page.getByLabel("Phrase à coder", { exact: true })).toHaveValue(
    "ABC XYZ",
  );
});
test("Codes is usable at 320px from a patrol with validation and unsupported characters preserved", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Codes", exact: true }).last().click();
  await expect(
    page.getByRole("heading", { name: "Atelier des codes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Alphabet numéroté/ }).click();
  await page.getByLabel("Nombre (1–26)", { exact: true }).fill("0");
  await expect(page.getByRole("alert")).toContainText("1 et 26");
  await expect(
    page.getByRole("button", { name: "Télécharger le texte", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Nombre (1–26)", { exact: true }).fill("1");
  await page
    .getByLabel("Phrase à coder", { exact: true })
    .fill("Éclaireur مرحبا!");
  await expect(page.locator(".cipher-warning")).toContainText("hors alphabet");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await page
    .getByLabel("Résultat", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Décoder", exact: true }).click();
  await page.getByLabel("Code à décoder", { exact: true }).fill(result);
  await expect(page.getByLabel("Résultat", { exact: true })).toHaveValue(
    "ECLAIREUR مرحبا!",
  );
  await page.screenshot({
    path: "/tmp/nexus-codes-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Vue d’ensemble", exact: true })
    .click();
  await page.getByRole("button", { name: "Codes", exact: true }).last().click();
  await expect(page.getByLabel("Résultat", { exact: true })).toHaveValue(
    "ECLAIREUR مرحبا!",
  );
});
