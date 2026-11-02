import { getStore } from "@netlify/blobs";
import { createCuisinierHandler } from "../lib/cuisinier.js";
const read = createCuisinierHandler({
  store: () => getStore({ name: "nexus-cuisinier-v1", consistency: "strong" }),
});
export default function handler(request) {
  if (request.method === "GET") return read(request);
  const url = new URL(request.url);
  url.pathname = "/.netlify/functions/cuisinier-write";
  return Response.redirect(url, 307);
}
