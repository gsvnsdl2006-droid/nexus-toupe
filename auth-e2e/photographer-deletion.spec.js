import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
import { createPhotographerHandler } from "../netlify/lib/photographer.js";
import { authorizeLeader } from "../netlify/lib/leader-auth.js";
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
for (const email of [
  "gsvnsdl2006@gmail.com",
  "troupeoriongsvn@gmail.com",
  "goelandaularge@gmail.com",
]) {
  test(`public photo album deletion permissions for ${email}`, async ({
    page,
  }) => {
    const records = new Map();
    let revision = 0;
    const store = {
      get: async (key) => records.get(key)?.value || null,
      getMetadata: async (key) =>
        records.has(key) ? { metadata: records.get(key).metadata } : null,
      getWithMetadata: async (key) =>
        records.has(key)
          ? {
              data: structuredClone(records.get(key).value),
              etag: records.get(key).etag,
            }
          : null,
      list: async ({ prefix }) => ({
        blobs: [...records.keys()]
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
      }),
      setJSON: async (key, value, options) => {
        if (
          (options.onlyIfNew && records.has(key)) ||
          (options.onlyIfMatch &&
            records.get(key)?.etag !== options.onlyIfMatch)
        )
          return { modified: false };
        records.set(key, {
          value,
          metadata: options.metadata,
          etag: String(++revision),
        });
        return { modified: true };
      },
    };
    const handler = createPhotographerHandler({
      store: () => store,
      authorizeDelete: (request) =>
        authorizeLeader(request, async () =>
          Response.json({
            id: "verified-user",
            email,
            email_confirmed_at: "2026-10-29",
          }),
        ),
    });
    await handler(
      new Request("https://app.test/.netlify/functions/photographer?patrol=0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "12345678-1234-4123-8123-123456789012",
          title: "Réunion photo",
          date: "2026-10-29",
          photos: [{ name: "camp.png", data: image }],
        }),
      }),
    );
    await mock(page, ["Goélands"], { email });
    await page.route("**/.netlify/functions/photographer?*", async (route) => {
      const r = route.request();
      const response = await handler(
        new Request(r.url(), { method: r.method(), headers: r.headers() }),
      );
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      });
    });
    await page.goto("/");
    await page
      .locator(".codes-entry")
      .filter({ hasText: "Photographe" })
      .click();
    await expect(page.locator(".photo-event-card")).toContainText(
      "Réunion photo",
    );
    await expect(
      page.getByRole("button", { name: /Supprimer l’événement photo/ }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Connexion administrateur", exact: true })
      .click();
    // Google callback restores this public section, without opening a private gate.
    await expect(
      page.getByRole("heading", { name: "Photographe", exact: true }),
    ).toBeVisible();
    const button = page.getByRole("button", {
      name: "Supprimer l’événement photo Réunion photo",
      exact: true,
    });
    if (email === "goelandaularge@gmail.com") {
      await expect(page.locator(".photo-event-card")).toContainText(
        "Réunion photo",
      );
      await expect(button).toHaveCount(0);
      expect([...records.values()][0].value.photos).toHaveLength(1);
      return;
    }
    await expect(button).toBeVisible();
    page.once("dialog", (d) => d.dismiss());
    await button.click();
    await expect(page.locator(".photo-event-card")).toHaveCount(1);
    page.once("dialog", (d) => d.accept());
    await button.click();
    await expect(page.locator(".photo-event-card")).toHaveCount(0);
    await expect(page.locator(".photo-notice")).toContainText("supprimés");
    expect([...records.values()][0].value.deleted).toBe(true);
    expect([...records.values()][0].value.photos).toBeUndefined();
    await page.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(
      page.getByText("Le prochain souvenir commence avec toi."),
    ).toBeVisible();
  });
}
