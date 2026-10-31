import { getStore } from "@netlify/blobs";
import { createSharedWorkspaceHandler } from "../lib/shared-workspace.js";
const handler = createSharedWorkspaceHandler({
  store: () =>
    getStore({ name: "nexus-shared-workspace-v1", consistency: "strong" }),
});
export default (request) => {
  if (request.method === "GET") return handler(request);
  const url = new URL(request.url);
  url.pathname = "/.netlify/functions/shared-workspace-write";
  return Response.redirect(url, 307);
};
