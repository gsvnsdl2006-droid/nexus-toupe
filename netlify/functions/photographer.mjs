import { getStore } from "@netlify/blobs";
import { createPhotographerHandler } from "../lib/photographer.js";
const read = createPhotographerHandler({
  store: () =>
    getStore({ name: "nexus-photographer-v1", consistency: "strong" }),
});
export default function handler(request) {
  if (request.method === "GET") return read(request);
  const target = new URL(request.url);
  target.pathname = "/.netlify/functions/photographer-write";
  return Response.redirect(target, 307);
}
