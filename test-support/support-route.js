import { createPatrolSupportHandler } from "../netlify/lib/patrol-support.js";
import { authorizeLeader } from "../netlify/lib/leader-auth.js";
export function supportApi(store, email) {
  const handler = createPatrolSupportHandler({
    store: () => store,
    authorizeAdmin: email
      ? (request) =>
          authorizeLeader(request, async () =>
            Response.json({
              id: "verified-user",
              email,
              email_confirmed_at: "2026-10-30",
            }),
          )
      : undefined,
  });
  return {
    handler,
    route: async (route) => {
      const r = route.request();
      const response = await handler(
        new Request(r.url(), {
          method: r.method(),
          headers: r.headers(),
          ...(r.method() === "POST" ? { body: r.postData() } : {}),
        }),
      );
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      });
    },
  };
}
