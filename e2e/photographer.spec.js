import { test, expect } from "@playwright/test";
import { createPhotographerHandler } from "../netlify/lib/photographer.js";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("anyone can publish four compressed photos, retry safely, and see a shared patrol album on another phone", async ({
  page,
  browser,
}) => {
  const records = new Map();
  const store = {
    get: async (key) => records.get(key)?.value || null,
    getMetadata: async (key) =>
      records.get(key) ? { metadata: records.get(key).metadata } : null,
    list: async ({ prefix }) => ({
      blobs: [...records.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
    }),
    setJSON: async (key, value, options) => {
      if (records.has(key)) return { modified: false };
      records.set(key, { value, metadata: options.metadata });
      return { modified: true };
    },
  };
  const handler = createPhotographerHandler({ store: () => store });
  let dropResponse = false;
  async function api(route) {
    const request = route.request();
    const response = await handler(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        ...(request.method() === "POST" ? { body: request.postData() } : {}),
      }),
    );
    if (dropResponse && request.method() === "POST") {
      dropResponse = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Connexion interrompue. Réessaie." }),
      });
    }
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  }
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(AbortSignal, "timeout", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "structuredClone", {
      configurable: true,
      value: undefined,
    });
  });
  await page.route("**/.netlify/functions/photographer?*", api);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".codes-entry").filter({ hasText: "Photographe" }).click();
  await expect(
    page.getByText("Le prochain souvenir commence avec toi."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Créer un événement", exact: true })
    .click();
  await page
    .getByLabel("Nom de l’événement ou de la réunion")
    .fill("Sortie des Goélands");
  const file = (n) => ({
    name: `souvenir-${n}.png`,
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByLabel("Photos de l’événement")
    .setInputFiles([1, 2, 3, 4, 5].map(file));
  await expect(page.getByRole("alert")).toContainText("4 photos maximum");
  await page
    .getByLabel("Photos de l’événement")
    .setInputFiles([1, 2, 3, 4].map(file));
  await expect(page.locator(".photo-selection img")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Publier l’événement et les photos" }),
  ).toBeEnabled();
  // Draft survives navigating/reloading before publication.
  await page.reload();
  await page.locator(".codes-entry").filter({ hasText: "Photographe" }).click();
  await expect(
    page.getByLabel("Nom de l’événement ou de la réunion"),
  ).toHaveValue("Sortie des Goélands");
  await expect(page.locator(".photo-selection img")).toHaveCount(4);
  dropResponse = true;
  await page
    .getByRole("button", { name: "Publier l’événement et les photos" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Connexion interrompue");
  await expect(page.locator(".photo-selection img")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Publier l’événement et les photos" })
    .click();
  await expect(page.locator(".photo-notice")).toContainText(
    "enregistrés durablement",
  );
  expect(records.size).toBe(1);
  const stored = [...records.values()][0].value;
  expect(
    stored.photos.every((p) => p.data.startsWith("data:image/jpeg;base64,")),
  ).toBe(true);
  await expect(page.locator(".photo-event-grid img")).toHaveCount(4);
  const fresh = await browser.newContext({
    viewport: { width: 320, height: 720 },
  });
  await fresh.route("**/.netlify/functions/photographer?*", api);
  const other = await fresh.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await other.getByRole("button", { name: "Photographe", exact: true }).click();
  await expect(other.locator(".photo-event-card")).toContainText(
    "Sortie des Goélands",
  );
  await expect(other.locator(".photo-event-grid img")).toHaveCount(4);
  await expect
    .poll(() =>
      other
        .locator(".photo-event-grid img")
        .evaluateAll((imgs) => imgs.every((img) => img.naturalWidth > 0)),
    )
    .toBe(true);
  for (const width of [390, 820, 1440]) {
    await other.setViewportSize({ width, height: 1000 });
    await expect(other.locator(".photo-event-grid img")).toHaveCount(4);
    expect(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await other.setViewportSize({ width: 320, height: 720 });
  await other.evaluate(() => window.scrollTo(0, 0));
  await other.screenshot({
    path: "/tmp/nexus-photographer-gallery.png",
    fullPage: true,
  });
  await other
    .getByRole("button", {
      name: "Agrandir Sortie des Goélands, photo 1",
      exact: true,
    })
    .click();
  await expect(other.getByRole("dialog")).toBeVisible();
  await other
    .getByRole("button", { name: "Fermer la photo", exact: true })
    .click();
  await other.getByLabel("Patrouille", { exact: true }).selectOption("1");
  await expect(
    other.getByText("Le prochain souvenir commence avec toi."),
  ).toBeVisible();
  expect(
    await other.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await other.screenshot({
    path: "/tmp/nexus-photographer-mobile.png",
    fullPage: true,
  });
  await fresh.close();
});

test("public albums remain accessible when a browser refuses local IndexedDB storage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          throw Error("Storage disabled");
        },
      },
    });
  });
  await page.route("**/.netlify/functions/photographer?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ events: [], cursor: null }),
    }),
  );
  await page.goto("/");
  await page.locator(".codes-entry").filter({ hasText: "Photographe" }).click();
  await expect(
    page.getByText("Le prochain souvenir commence avec toi."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Créer un événement", exact: true }),
  ).toBeEnabled();
});
