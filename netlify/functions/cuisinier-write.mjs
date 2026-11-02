import { getStore } from "@netlify/blobs";
import { createCuisinierHandler } from "../lib/cuisinier.js";
export default createCuisinierHandler({
  store: () => getStore({ name: "nexus-cuisinier-v1", consistency: "strong" }),
});
export const config = {
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
