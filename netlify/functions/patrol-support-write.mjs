import { getStore } from "@netlify/blobs";
import { createPatrolSupportHandler } from "../lib/patrol-support.js";
export default createPatrolSupportHandler({
  store: () =>
    getStore({ name: "nexus-patrol-support-v1", consistency: "strong" }),
  authorizeAdmin: async () => ({ ok: true }),
});
export const config = {
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
