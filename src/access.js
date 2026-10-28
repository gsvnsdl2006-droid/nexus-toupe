import { createClient } from "@supabase/supabase-js";
const url = import.meta.env?.VITE_SUPABASE_URL,
  key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const accessClient =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
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
