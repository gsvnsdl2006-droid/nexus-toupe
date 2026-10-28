import { getStore } from "@netlify/blobs";
import { createBadgeHandler } from "../lib/badge-images.js";
import { projectConfig } from "../../src/project-config.js";
const url = process.env.VITE_SUPABASE_URL || projectConfig.url,
  key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || projectConfig.publishableKey;
export async function authorize(request, fetcher = fetch) {
  const header = request.headers.get("authorization") || "";
  if (!/^Bearer \S+$/.test(header)) return { ok: false, status: 401 };
  const headers = { Authorization: header, apikey: key };
  try {
    const response = await fetcher(`${url}/auth/v1/user`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { ok: false, status: 401 };
    const user = await response.json();
    if (!user.id || !user.email) return { ok: false, status: 401 };
    const access = await fetcher(
      `${url}/rest/v1/patrol_access?select=patrol&limit=1`,
      { headers, signal: AbortSignal.timeout(10000) },
    );
    if (!access.ok)
      return {
        ok: false,
        status: 503,
        error: "Could not verify photo permissions. Your local copy is kept.",
      };
    const rows = await access.json();
    return Array.isArray(rows) && rows.length
      ? { ok: true }
      : {
          ok: false,
          status: 403,
          error:
            "This account is not on the troop access list. Your photo is kept on this device.",
        };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Photo permissions could not be checked. Your local copy is kept.",
    };
  }
}
export default createBadgeHandler({
  store: () =>
    getStore({ name: "nexus-badge-images-v1", consistency: "strong" }),
  authorize,
});
