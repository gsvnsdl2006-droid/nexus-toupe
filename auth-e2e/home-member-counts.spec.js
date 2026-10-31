import { test, expect } from "@playwright/test";
import { mock } from "../test-support/mock-supabase.js";
const patrols = [
  "Goélands",
  "Lions",
  "Guépards",
  "Orcs",
  "Renards",
  "Taureaux",
];
for (const width of [390, 1440])
  test(`home loads every authorized patrol count without opening patrols at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    const records = Object.fromEntries(
      patrols.map((name, i) => [
        name,
        {
          revision: 2,
          payload: {
            members: Array.from({ length: i + 1 }, (_, n) => ({
              id: `${i}-${n}`,
              name: `Member ${i}-${n}`,
            })),
            transactions: [],
            meetings: [],
            camp: {},
            camps: [],
          },
        },
      ]),
    );
    await mock(page, patrols, { email: "troupeoriongsvn@gmail.com" });
    await page.route(
      "https://nexus-access-test.supabase.co/rest/v1/patrol_records**",
      async (route) => {
        const name = new URL(route.request().url()).searchParams
          .get("patrol")
          ?.replace("eq.", "");
        expect(route.request().method()).toBe("GET");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([records[name]]),
        });
      },
    );
    await page.goto("/");
    await page
      .getByRole("button", { name: "Synchroniser les membres", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continue with Google", exact: true })
      .click();
    for (const [i, name] of patrols.entries()) {
      await expect(
        page.getByRole("button", { name: new RegExp(`PATROUILLE 0${i + 1}`) }),
      ).toContainText(`${i + 1} membres`);
    }
    await expect(page.locator("main > .patrol-heading")).toHaveCount(0);
    records["Lions"].payload.members.push({
      id: "new-lion",
      name: "Another lion",
    });
    records["Lions"].revision++;
    await page.clock.fastForward(10500);
    await expect(
      page.getByRole("button", { name: /PATROUILLE 02/ }),
    ).toContainText("3 membres");
  });
