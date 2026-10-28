import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mock } from "../test-support/mock-supabase.js";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
async function media(page, cloud) {
  await page.route("**/.netlify/functions/badge-images**", async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    if (r.method() === "PUT") {
      expect(r.headers().authorization).toMatch(/^Bearer /);
      const body = r.postDataJSON();
      const badge = Number(url.searchParams.get("badge")),
        version = createHash("sha256").update(body.image).digest("hex");
      cloud.set(badge, {
        badge,
        version,
        url: `/.netlify/functions/badge-images?badge=${badge}&version=${version}`,
        updatedAt: "2026-10-29T00:00:00Z",
      });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(cloud.get(badge)),
      });
    }
    if (url.searchParams.has("badge"))
      return route.fulfill({ contentType: "image/png", body: png });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ images: [...cloud.values()] }),
    });
  });
}
async function badge(page) {
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Progression", exact: true }).click();
  return page.locator(".badge-card").filter({ hasText: "Ami de Dieu" });
}
test("local legacy badge pictures back up after sign-in and survive a fresh browser/redeployment", async ({
  page,
  browser,
}) => {
  const cloud = new Map();
  await mock(page, ["Goélands"], { email: "gsvnsdl2006@gmail.com" });
  await media(page, cloud);
  await page.goto("/");
  await (await badge(page)).click();
  await page
    .getByLabel("Photo du badge", { exact: true })
    .setInputFiles({ name: "badge.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".badge-photo-editor .uploaded-image")).toHaveCount(
    1,
  );
  await page.reload();
  const card = await badge(page);
  await expect(card.locator("img")).toHaveCount(1);
  await card.click();
  await page
    .getByRole("button", {
      name: "Connecter Google pour protéger les photos",
      exact: true,
    })
    .click();
  await expect.poll(() => cloud.size).toBe(1);
  await expect
    .poll(async () => {
      const result = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const request = indexedDB.open("keyval-store");
            request.onsuccess = () => {
              const read = request.result
                .transaction("keyval", "readonly")
                .objectStore("keyval")
                .get("nexus-badge-photo:4");
              read.onsuccess = () => resolve(read.result?.pending);
            };
          }),
      );
      return result;
    })
    .toBe(false);
  const fresh = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const next = await fresh.newPage();
    await media(next, cloud);
    await next.goto("http://127.0.0.1:5176/");
    const recovered = await badge(next);
    await expect(recovered.locator("img")).toHaveAttribute(
      "src",
      cloud.get(4).url,
    );
    expect(
      await recovered
        .locator("img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
  } finally {
    await fresh.close();
  }
});
