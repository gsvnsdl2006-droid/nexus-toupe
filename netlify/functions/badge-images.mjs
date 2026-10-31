import { getStore } from "@netlify/blobs";
import { createBadgeHandler } from "../lib/badge-images.js";
export const authorize = async () => ({ ok: true });
export default createBadgeHandler({
  store: () =>
    getStore({ name: "nexus-badge-images-v1", consistency: "strong" }),
  authorize,
});
