import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
const payload = {
  members: [],
  meetings: [],
  transactions: [],
  camp: { "Ancien camp": { A1: "Archive" } },
  camps: [
    {
      id: "camp-a",
      title: "Camp été",
      fields: { title: "Camp été" },
      date: "2026-10-29",
      updated: 1,
    },
  ],
};
async function open(page) {
  await page.goto("/");
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Nouvelle réunion", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dossier de camp", exact: true })
    .click();
}
for (const email of ["gsvnsdl2006@gmail.com", "troupeoriongsvn@gmail.com"]) {
  test(`only admin ${email} can confirm deletion of new and legacy camp dossiers`, async ({
    page,
  }) => {
    const state = await mock(page, ["Goélands"], { email, payload });
    await open(page);
    const remove = page.getByRole("button", {
      name: "Supprimer le dossier Camp été",
      exact: true,
    });
    await expect(remove).toBeEnabled();
    page.once("dialog", (d) => d.dismiss());
    await remove.click();
    expect(state.updates).toHaveLength(0);
    await page.locator(".camp-folder").click();
    page.once("dialog", (d) => d.accept());
    await remove.click();
    await expect.poll(() => state.updates.length).toBe(1);
    expect(state.updates[0].payload.camps).toEqual([]);
    await expect(page.getByText("Préparons le prochain camp")).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Supprimer l’ancien dossier", exact: true })
      .click();
    await expect.poll(() => state.updates.length).toBe(2);
    expect(state.updates[1].payload.camp).toEqual({});
    await expect(page.locator(".legacy-camp")).toHaveCount(0);
  });
}
test("a patrol account cannot see dossier deletion controls", async ({
  page,
}) => {
  const state = await mock(page, ["Goélands"], {
    email: "goelandaularge@gmail.com",
    payload,
  });
  await open(page);
  await expect(page.getByRole("button", { name: /Supprimer/ })).toHaveCount(0);
  await page.locator(".camp-folder").click();
  await expect(page.getByRole("button", { name: /Supprimer/ })).toHaveCount(0);
  expect(state.updates).toHaveLength(0);
});
test("dossier deletion fails closed without the database migration", async ({
  page,
}) => {
  await mock(page, ["Goélands"], {
    email: "gsvnsdl2006@gmail.com",
    payload,
    campDeletionReady: false,
  });
  await open(page);
  await expect(
    page.getByRole("button", {
      name: "Supprimer le dossier Camp été",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Supprimer l’ancien dossier",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Télécharger la mise à jour SQL" }),
  ).toHaveAttribute("href", "/setup/camp-deletion.sql");
});
