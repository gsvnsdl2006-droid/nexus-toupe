import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mock } from "../test-support/mock-supabase.js";
import { supportStore } from "../test-support/support-store.js";
import { supportApi } from "../test-support/support-route.js";
import { createCuisinierHandler } from "../netlify/lib/cuisinier.js";
import { authorizeLeader } from "../netlify/lib/leader-auth.js";

async function routeRecipes(page, store) {
  const handler = createCuisinierHandler({
    store: () => store,
    authorize: (request) =>
      authorizeLeader(request, async () => {
        const payload = JSON.parse(
          Buffer.from(
            request.headers.get("authorization").split(".")[1],
            "base64url",
          ),
        );
        return Response.json({
          id: payload.sub,
          email: payload.email,
          email_confirmed_at: "2026-01-01",
        });
      }),
  });
  await page.route("**/.netlify/functions/cuisinier*", async (route) => {
    const input = route.request();
    const response = await handler(
      new Request(input.url(), {
        method: input.method(),
        headers: input.headers(),
        ...(["POST", "PATCH", "DELETE"].includes(input.method()) ? { body: input.postData() } : {}),
      }),
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}
async function open(page) {
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Intendance", exact: true }).click();
  await page
    .getByRole("link", { name: "Cuisinier · Recettes et expériences" })
    .click();
}

for (const email of ["gsvnsdl2006@gmail.com", "troupeoriongsvn@gmail.com"]) {
  test(`Cuisinier: ${email} adds recipes; anonymous visitors share photos and experiences across devices`, async ({
    page,
    browser,
  }) => {
    const store = supportStore(),
      equipment = supportApi(supportStore());
    await mock(page, ["Goélands"], { email });
    await routeRecipes(page, store);
    await page.route("**/.netlify/functions/patrol-support*", equipment.route);
    await open(page);
    const section = page.getByRole("region", {
      name: "Cuisinier",
      exact: true,
    });
    await expect(
      section.getByRole("button", { name: "Ajouter une recette", exact: true }),
    ).toHaveCount(0);
    await section
      .getByRole("button", { name: "Connexion administrateur Cuisinier" })
      .click();
    await page
      .getByRole("button", { name: "Ajouter une recette", exact: true })
      .click();
    await page
      .getByLabel("Nom de la recette", { exact: true })
      .fill("Riz de patrouille");
    await page.getByLabel("Ingrédients", { exact: true }).fill("Riz\nEau\nSel");
    await page
      .getByLabel("Préparation", { exact: true })
      .fill("Faire cuire 15 minutes.");
    await page
      .getByRole("button", { name: "Enregistrer la recette", exact: true })
      .click();
    await expect(page.locator(".cuisinier-recipe")).toContainText(
      "Riz de patrouille",
    );
    await expect(page.locator(".equipment-card")).toHaveCount(37);

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    try {
      const phone = await context.newPage();
      await mock(phone, []);
      await routeRecipes(phone, store);
      await phone.route(
        "**/.netlify/functions/patrol-support*",
        equipment.route,
      );
      await open(phone);
      await expect(
        phone.getByRole("button", { name: "Ajouter une recette", exact: true }),
      ).toHaveCount(0);
      await phone
        .getByRole("button", {
          name: "Voir les photos et partager mon expérience",
        })
        .click();
      await phone.getByLabel("Ton nom (facultatif)").fill("Un cuisinier");
      await phone
        .getByLabel("Ton expérience", { exact: true })
        .fill("Délicieux après la marche !");
      await phone
        .getByLabel("Photo de la recette", { exact: true })
        .setInputFiles({
          name: "plat.webp",
          mimeType: "image/webp",
          buffer: await readFile("public/branding/goelands.webp"),
        });
      await expect(
        phone.getByAltText("Photo sélectionnée de la recette"),
      ).toBeVisible();
      await phone
        .getByRole("button", { name: "Partager mon expérience", exact: true })
        .click();
      await expect(phone.locator(".cuisinier-experience")).toContainText(
        "Délicieux après la marche !",
      );
      await page
        .getByRole("button", {
          name: "Voir les photos et partager mon expérience",
        })
        .click();
      await expect(page.locator(".cuisinier-experience")).toContainText(
        "Délicieux après la marche !",
      );
      await expect
        .poll(() =>
          page
            .locator(".cuisinier-experience img")
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      await phone.reload();
      await phone.getByRole("button", { name: /PATROUILLE 01/ }).click();
      await phone
        .getByRole("button", { name: "Intendance", exact: true })
        .click();
      await phone
        .getByRole("button", {
          name: "Voir les photos et partager mon expérience",
        })
        .click();
      await expect(phone.locator(".cuisinier-experience")).toContainText(
        "Délicieux après la marche !",
      );
      await expect(phone.getByRole("button", { name: "Modifier la recette", exact: true })).toHaveCount(0);
      await expect(phone.getByRole("button", { name: "Supprimer la recette", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Modifier la recette", exact: true }).click();
      await page.getByLabel("Nom de la recette", { exact: true }).fill("Riz amélioré");
      await page.getByRole("button", { name: "Enregistrer la recette", exact: true }).click();
      await expect(page.locator(".cuisinier-recipe h3")).toHaveText("Riz amélioré");
      await expect(page.locator(".cuisinier-experience")).toContainText("Délicieux après la marche !");
      await phone.getByRole("button", { name: "Actualiser les recettes", exact: true }).click();
      await expect(phone.locator(".cuisinier-recipe h3")).toHaveText("Riz amélioré");
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByRole("button", { name: "Supprimer la recette", exact: true }).click();
      await expect(page.locator(".cuisinier-recipe")).toHaveCount(1);
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Supprimer la recette", exact: true }).click();
      await expect(page.locator(".cuisinier-recipe")).toHaveCount(0);
      await phone.getByRole("button", { name: "Actualiser les recettes", exact: true }).click();
      await expect(phone.locator(".cuisinier-recipe")).toHaveCount(0);
      for (const width of [320, 820, 1440]) {
        await phone.setViewportSize({ width, height: 900 });
        expect(
          await phone.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    } finally {
      await context.close();
    }
  });
}

test("a patrol account cannot add a recipe", async ({ page }) => {
  await mock(page, ["Goélands"], { email: "goelandaularge@gmail.com" });
  await routeRecipes(page, supportStore());
  await page.route(
    "**/.netlify/functions/patrol-support*",
    supportApi(supportStore()).route,
  );
  await open(page);
  await page
    .getByRole("button", { name: "Connexion administrateur Cuisinier" })
    .click();
  await expect(
    page.getByRole("button", { name: "Connexion administrateur Cuisinier" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ajouter une recette", exact: true }),
  ).toHaveCount(0);
});
