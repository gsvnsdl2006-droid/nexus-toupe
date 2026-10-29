import { authorizeLeader } from "../lib/leader-auth.js";
import { getStore } from "@netlify/blobs";
import { createPhotographerHandler } from "../lib/photographer.js";
export default createPhotographerHandler({
  authorizeDelete: authorizeLeader,
  store: () =>
    getStore({ name: "nexus-photographer-v1", consistency: "strong" }),
});
// Public uploads stay bounded without imposing a login on photographers.
export const config = {
  rateLimit: {
    windowLimit: 40,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
