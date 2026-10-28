import { test, expect } from "@playwright/test";
async function mockDrive(page, remote = null) {
  await page.addInitScript((remote) => {
    remote =
      JSON.parse(sessionStorage.getItem("mock-backup") || "null") || remote;
    localStorage.setItem(
      "nexus-google-client",
      "test.apps.googleusercontent.com",
    );
    const state = (window.__driveTest = {
      files: [],
      backup: remote,
      writes: 0,
      fail: false,
      hold: false,
      release: null,
      uploads: 0,
      campFiles: [],
    });
    let id = 0;
    if (remote) {
      state.files = [
        { id: "root", name: "Nexus Troupe Orion" },
        { id: "backup", name: "nexus-backup.json", parents: ["root"] },
      ];
    }
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (options) => ({
            requestAccessToken: () =>
              options.callback({
                access_token: "mock-token",
                expires_in: 3600,
              }),
          }),
          revoke: () => {},
        },
      },
    };
    const original = window.fetch.bind(window);
    window.fetch = async (url, options = {}) => {
      if (!String(url).startsWith("https://www.googleapis.com/"))
        return original(url, options);
      const reply = (x, status = 200) =>
        new Response(JSON.stringify(x), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      if (state.fail) return reply({ error: "expired" }, 401);
      const u = new URL(url);
      if (u.searchParams.has("q")) {
        const q = u.searchParams.get("q");
        const name = q.match(/name = '([^']+)'/)?.[1];
        const parent = q.match(/and '([^']+)' in parents/)?.[1];
        return reply({
          files: state.files.filter(
            (f) => f.name === name && (!parent || f.parents?.includes(parent)),
          ),
        });
      }
      if (u.searchParams.get("alt") === "media") return reply(state.backup);
      if (options.body instanceof FormData) {
        const metadata = JSON.parse(await options.body.get("metadata").text());
        state.uploads++;
        if (metadata.name.endsWith(".xlsx"))
          state.campFiles.push({
            name: metadata.name,
            bytes: Array.from(
              new Uint8Array(await options.body.get("file").arrayBuffer()),
            ),
          });
        if (metadata.name === "nexus-backup.json") {
          if (state.hold)
            await new Promise((resolve) => {
              state.release = resolve;
            });
          state.backup = JSON.parse(await options.body.get("file").text());
          state.writes++;
          sessionStorage.setItem("mock-backup", JSON.stringify(state.backup));
        }
        const existing =
          options.method === "PATCH"
            ? state.files.find((f) => f.id === u.pathname.split("/").pop())
            : null;
        const file = existing || { id: String(++id), ...metadata };
        if (!existing) state.files.push(file);
        return reply(file);
      }
      if (options.method === "POST") {
        const file = { id: String(++id), ...JSON.parse(options.body) };
        state.files.push(file);
        return reply(file);
      }
      throw Error("Unexpected mocked Drive request " + url);
    };
  }, remote);
}
async function connect(page) {
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Identifiant client Google OAuth" })
    .fill("test.apps.googleusercontent.com");
  await page
    .getByRole("button", { name: "Connecter Google", exact: true })
    .click();
  await expect(
    page.getByText("Google Drive connecté", { exact: true }),
  ).toBeVisible();
  await page.locator(".modal-close").click();
}
async function addMember(page, name) {
  await page.getByRole("button", { name: /Gérer les membres/ }).click();
  await page.getByLabel("Prénom et nom").fill(name);
  await page.getByRole("button", { name: "Ajouter un membre" }).click();
  await page.locator(".modal-close").click();
}
test("automatic archive saves edits, queues changes in flight and preserves data after expired Google session", async ({
  page,
}) => {
  await mockDrive(page);
  await page.goto("/");
  await connect(page);
  await expect
    .poll(() => page.evaluate(() => window.__driveTest.writes))
    .toBe(1);
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.evaluate(() => {
    window.__driveTest.hold = true;
  });
  await addMember(page, "Premier Scout");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__driveTest.release)))
    .toBe(true);
  await addMember(page, "Deuxième Scout");
  await page.evaluate(() => {
    window.__driveTest.hold = false;
    window.__driveTest.release();
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__driveTest.backup?.patrols["Goélands"].members.length,
        ),
      { timeout: 15000 },
    )
    .toBe(2);
  await expect(page.locator(".cloud-status")).toContainText("À jour sur Drive");
  await page.evaluate(() => {
    window.__driveTest.fail = true;
  });
  await addMember(page, "Troisième Scout");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__driveTest.backup.patrols["Goélands"].members.length,
      ),
    )
    .toBe(2);
  await expect(page.getByRole("button", { name: /Mode local/ })).toBeVisible({
    timeout: 10000,
  });
  await page.reload();
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await expect(page.locator(".patrol-title")).toContainText("3");
});
test("connecting a fresh device restores the existing archive before any upload", async ({
  page,
}) => {
  const { initial } = await import("../src/model.js");
  const remote = initial();
  remote.patrols.Lions.members = [{ id: "remote-member", name: "Scout Drive" }];
  await mockDrive(page, remote);
  await page.goto("/");
  await connect(page);
  await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
  await expect(page.locator(".patrol-title")).toContainText("1");
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.__driveTest.writes)).toBe(0);
});

test("inline Drive connection saves camp folders and generated Excel without visiting settings and resumes after reload", async ({
  page,
}) => {
  await mockDrive(page);
  await page.goto("/");
  await page
    .locator(".drive-toolbar")
    .getByRole("button", { name: "Connecter Drive", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__driveTest.writes))
    .toBe(1);
  await expect(page.locator(".modal")).toHaveCount(0);
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await page.getByRole("button", { name: "Secrétariat", exact: true }).click();
  await page
    .getByRole("button", { name: "Dossier de camp", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nouveau dossier", exact: true })
    .click();
  await page
    .getByLabel("Nom du dossier", { exact: true })
    .fill("Camp automatique");
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  await page
    .locator(".camp-categories button")
    .filter({ hasText: "Objectifs" })
    .click();
  await page
    .getByLabel("Nos objectifs", { exact: true })
    .fill("Solidarité et autonomie");
  await page
    .getByRole("button", { name: "Enregistrer la catégorie", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            window.__driveTest.backup?.patrols["Goélands"].camps?.[0]?.fields
              .goals,
        ),
      { timeout: 15000 },
    )
    .toBe("Solidarité et autonomie");
  const files = await page.evaluate(() => window.__driveTest.campFiles);
  expect(files.at(-1).name).toBe("Dossier de camp Camp automatique.xlsx");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(Uint8Array.from(files.at(-1).bytes));
  expect(workbook.Sheets.Objectifs.B7.v).toBe("Solidarité et autonomie");
  expect(
    await page.evaluate(() =>
      window.__driveTest.files.some((f) =>
        f.name.startsWith("Camp automatique ["),
      ),
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator(".drive-toolbar")).toContainText(
    "Enregistré dans Google Drive",
  );
  await page.getByRole("button", { name: /PATROUILLE 01/ }).click();
  await addMember(page, "Scout après actualisation");
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__driveTest.backup?.patrols["Goélands"].members.length,
        ),
      { timeout: 15000 },
    )
    .toBe(1);
});
