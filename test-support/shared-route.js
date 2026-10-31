import { createSharedWorkspaceHandler } from "../netlify/lib/shared-workspace.js";
export function sharedWorkspaceApi(store, { publicEdits = true } = {}) {
  const handler = createSharedWorkspaceHandler({
    store: () => store,
    authorizeAdmin: async (request) => ({
      ok: publicEdits || Boolean(request.headers.get("authorization")),
      status: 403,
    }),
  });
  return async (route) => {
    const request = route.request();
    const response = await handler(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        ...(request.method() === "POST" ? { body: request.postData() } : {}),
      }),
    );
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  };
}
