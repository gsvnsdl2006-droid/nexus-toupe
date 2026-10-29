import { getStore } from "@netlify/blobs";
import { createPatrolSupportHandler } from "../lib/patrol-support.js";
const read = createPatrolSupportHandler({
  store: () =>
    getStore({ name: "nexus-patrol-support-v1", consistency: "strong" }),
});
export default function handler(request) {
  if (request.method === "GET") return read(request);
  const url = new URL(request.url);
  url.pathname = "/.netlify/functions/patrol-support-write";
  return Response.redirect(url, 307);
}
