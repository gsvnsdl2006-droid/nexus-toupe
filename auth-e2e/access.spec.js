import { test, expect } from "@playwright/test";
async function mock(page, allowed) {
  const email = "test@example.com";
  const user = () => ({
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: "2026-10-28T00:00:00Z",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: {},
    created_at: "2026-10-28T00:00:00Z",
  });
  await page.route(
    "https://nexus-access-test.supabase.co/**",
    async (route) => {
      const r = route.request(),
        url = r.url();
      const json = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.includes("/auth/v1/authorize")) {
        const parsed = new URL(url);
        expect(parsed.searchParams.get("provider")).toBe("google");
        expect(parsed.searchParams.get("redirect_to")).toBe(
          "http://127.0.0.1:5176/",
        );
        expect(parsed.searchParams.get("code_challenge_method")).toBe("s256");
        expect(parsed.searchParams.get("scopes") || "").not.toContain("drive");
        return route.fulfill({
          status: 302,
          headers: { location: "http://127.0.0.1:5176/?code=test-google-code" },
          body: "",
        });
      }
      if (url.includes("/auth/v1/token")) {
        expect(new URL(url).searchParams.get("grant_type")).toBe("pkce");
        expect(r.postDataJSON().auth_code).toBe("test-google-code");
        expect(r.postDataJSON().code_verifier.length).toBeGreaterThan(40);
        const header = Buffer.from(
            JSON.stringify({ alg: "HS256", typ: "JWT" }),
          ).toString("base64url"),
          payload = Buffer.from(
            JSON.stringify({
              sub: user().id,
              email,
              aud: "authenticated",
              role: "authenticated",
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ).toString("base64url");
        return json({
          access_token: `${header}.${payload}.test`,
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: user(),
        });
      }
      if (url.includes("/auth/v1/user")) return json(user());
      if (url.includes("/rest/v1/patrol_access"))
        return json(allowed.map((patrol) => ({ patrol })));
      if (url.includes("/rest/v1/patrol_records"))
        return json([
          {
            revision: 1,
            payload: {
              members: [],
              meetings: [],
              camp: {},
              camps: [],
              transactions: [
                {
                  id: "private-record",
                  activity: "concours cuisine",
                  type: "in",
                  amount: 25,
                  date: "2026-10-28",
                  description: "Cotisation privée",
                },
              ],
            },
          },
        ]);
      return json({});
    },
  );
}
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
      await expect(page.locator("tbody")).toContainText("Cotisation privée");
      await page.reload();
      await page.getByRole("button", { name: /PATROUILLE 02/ }).click();
      await page
        .getByRole("button", { name: "Trésorier", exact: true })
        .click();
      await expect(page.locator("tbody")).toContainText("Cotisation privée");
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
