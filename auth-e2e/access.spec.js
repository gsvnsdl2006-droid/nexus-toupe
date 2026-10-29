import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
for (const allowed of [[], ["Lions"]])
  test(`verified e-mail ${allowed.length ? "is restricted to its own patrol" : "with no grant cannot open protected sections"}`, async ({
    page,
  }) => {
    await mock(page, allowed);
    await page.goto("/");
    await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
    await page.getByRole("button", { name: "Trésorier", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Accès réservé · Goélands" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Opération", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Continue with Google", exact: true })
      .click();
    await expect(
      page.getByText(
        "Cette adresse n’a pas accès à cette patrouille : test@example.com.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Opération", exact: true }),
    ).toHaveCount(0);
    if (allowed.length) {
      await page.getByRole("button", { name: /Tableau de bord ·/ }).click();
      await page
        .getByRole("button", { name: "Toutes les patrouilles" })
        .click();
      await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
      await page
        .getByRole("button", { name: "Trésorier", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Opération", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Ouvrir l’événement concours cuisine",
          exact: true,
        })
        .click();
      await expect(page.locator("tbody")).toContainText("Cotisation privée");
      await page.reload();
      await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
      await page
        .getByRole("button", { name: "Trésorier", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Ouvrir l’événement concours cuisine",
          exact: true,
        })
        .click();
      await expect(page.locator("tbody")).toContainText("Cotisation privée");
      await page.getByRole("button", { name: /Tableau de bord ·/ }).click();
      await page
        .getByRole("button", { name: "Toutes les patrouilles" })
        .click();
      await page.getByRole("button", { name: /PATROUILLE 03/ }).click();
      await page
        .getByRole("button", { name: "Secrétariat", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Accès réservé · Guépards" }),
      ).toBeVisible();
    }
  });

test("a cancelled Google sign-in returns to the selected patrol with a retry button", async ({
  page,
}) => {
  await page.route(
    "https://nexus-access-test.supabase.co/auth/v1/authorize**",
    (route) =>
      route.fulfill({
        status: 302,
        headers: {
          location:
            "http://127.0.0.1:5176/?error=access_denied&error_description=Sign-in%20cancelled",
        },
        body: "",
      }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Accès réservé · Lions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText("cancelled");
});

const fixture = {
  members: [{ id: "member-a", name: "Scout à supprimer" }],
  meetings: [
    {
      id: "event-a",
      title: "Réunion à supprimer",
      date: "2026-10-29",
      summary: "Rapport",
      attendance: { "member-a": "present" },
    },
  ],
  transactions: [],
  camp: {},
  camps: [],
};
for (const email of [
  "gsvnsdl2006@gmail.com",
  "troupeoriongsvn@gmail.com",
  "goelandaularge@gmail.com",
])
  test(`deletion controls and persistence for ${email}`, async ({ page }) => {
    const state = await mock(page, ["Goélands"], { email, payload: fixture });
    await page.goto("/");
    await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
    await page
      .getByRole("button", { name: "Secrétariat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continue with Google", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Nouvelle réunion", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Gérer les membres/ }).click();
    const deletion = page.getByRole("button", {
      name: "Supprimer Scout à supprimer",
      exact: true,
    });
    if (email === "goelandaularge@gmail.com") {
      await expect(deletion).toHaveCount(0);
      await page.locator(".modal-close").click();
      await page.locator(".meeting-card").click();
      await expect(
        page.getByRole("button", { name: "Supprimer la réunion", exact: true }),
      ).toHaveCount(0);
      expect(state.updates).toHaveLength(0);
      return;
    }
    page.on("dialog", (d) => d.accept());
    await expect(deletion).toBeEnabled();
    await deletion.click();
    await expect(page.locator(".member-list")).not.toContainText(
      "Scout à supprimer",
    );
    await expect.poll(() => state.updates.length).toBe(1);
    expect(state.updates[0].payload.meetings[0].memberNames["member-a"]).toBe(
      "Scout à supprimer",
    );
    await page.locator(".modal-close").click();
    await page.locator(".meeting-card").click();
    await page
      .getByRole("button", { name: "Supprimer la réunion", exact: true })
      .click();
    await expect.poll(() => state.updates.length).toBe(2);
    expect(state.updates[1].payload.meetings).toEqual([]);
    await expect(page.locator(".meeting-card")).toHaveCount(0);
  });
test("leader deletion stays disabled until the database migration is installed", async ({
  page,
}) => {
  await mock(page, ["Goélands"], {
    email: "gsvnsdl2006@gmail.com",
    payload: fixture,
    deletionReady: false,
  });
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Nouvelle réunion", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await expect(
    page.getByRole("button", {
      name: "Supprimer Scout à supprimer",
      exact: true,
    }),
  ).toBeDisabled();
});
