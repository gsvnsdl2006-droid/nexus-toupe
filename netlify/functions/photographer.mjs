import { getStore } from "@netlify/blobs";
import { createPhotographerHandler } from "../lib/photographer.js";
export default createPhotographerHandler({
  store: () =>
    getStore({ name: "nexus-photographer-v1", consistency: "strong" }),
});
// Public uploads stay bounded without imposing a login on photographers.
export const config = {
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
