import { getStore } from "@netlify/blobs";
import { createSharedWorkspaceHandler } from "../lib/shared-workspace.js";
export default createSharedWorkspaceHandler({
  store: () =>
    getStore({ name: "nexus-shared-workspace-v1", consistency: "strong" }),
  authorizeAdmin: async () => ({ ok: true }),
});
export const config = {
  rateLimit: {
    windowLimit: 100,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
