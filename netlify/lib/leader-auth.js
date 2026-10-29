import { projectConfig } from "../../src/project-config.js";
import { isLeader } from "../../src/leader-policy.js";
const url = process.env.VITE_SUPABASE_URL || projectConfig.url;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || projectConfig.publishableKey;
export async function authorizeLeader(request, fetcher = fetch) {
  const token = request.headers.get("authorization") || "";
  if (!/^Bearer \S+$/.test(token)) return { ok: false, status: 401 };
  try {
    const response = await fetcher(`${url}/auth/v1/user`, {
      headers: { Authorization: token, apikey: key },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      return { ok: false, status: response.status >= 500 ? 503 : 401 };
    const user = await response.json();
    return isLeader(user) && user.email_confirmed_at
      ? { ok: true }
      : { ok: false, status: 403 };
  } catch {
    return { ok: false, status: 503 };
  }
}
