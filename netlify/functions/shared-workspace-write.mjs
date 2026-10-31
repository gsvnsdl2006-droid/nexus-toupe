import { getStore } from "@netlify/blobs";
import { createSharedWorkspaceHandler } from "../lib/shared-workspace.js";
import { authorizeLeader } from "../lib/leader-auth.js";
export default createSharedWorkspaceHandler({
  store: () =>
    getStore({ name: "nexus-shared-workspace-v1", consistency: "strong" }),
  authorizeAdmin: authorizeLeader,
});
export const config = {
  rateLimit: {
    windowLimit: 100,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
