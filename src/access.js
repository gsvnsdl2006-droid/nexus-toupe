import { projectConfig } from "./project-config.js";
import { createClient } from "@supabase/supabase-js";
const url = import.meta.env?.VITE_SUPABASE_URL || projectConfig.url,
  key =
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    projectConfig.publishableKey;
export const accessClient =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
export const privateFields = [
  "members",
  "transactions",
  "meetings",
  "camp",
  "camps",
];
export const privatePayload = (p) =>
  Object.fromEntries(
    privateFields.map((k) => [k, p[k] ?? (k === "camp" ? {} : [])]),
  );
