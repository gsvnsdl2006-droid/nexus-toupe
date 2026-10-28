# Private treasury and secretariat

The application uses **Google sign-in through Supabase**, with a persisted, refreshed session. No email sender, SMTP, Resend or Google Drive authorization is used.

See [ETAPES.md](ETAPES.md) for the current setup status and remaining connection steps. The two confirmed leaders and six patrol addresses are seeded by [setup.sql](setup.sql), exactly three authorized addresses per patrol.

## Security and data

Google credentials belong only in Supabase's Google provider settings. Frontend configuration contains only the Project URL and public Publishable/anon key. No secret/service_role key is used by the app.

The frontend uses the OAuth authorization-code flow with PKCE. Supabase consumes the callback code, remembers the session, and refreshes it. Only basic Google identity scopes are used; no Drive permissions are requested. The login callback restores the patrol/section selected before sign-in. A cancelled login returns to a retry screen instead of leaving a disabled button.

Database row-level security (RLS) checks the authenticated email against `patrol_access`. Clients cannot edit this allowlist. An unapproved authenticated account still cannot read or write `patrol_records`. Google identity verification does not replace these database policies.

Treasury/secretariat updates use revision checks to avoid overwriting another user's remote changes. Local copies are retained before loading differing private data, with the latest recovery copy downloadable from Archives & exports. Existing local copies and files are not encrypted or revoked by adding authentication. Progression remains local and does not require login.

## Tests and activation

`npx playwright test --config playwright.access.config.js` tests the Google redirect, PKCE code exchange, remembered session, selected-patrol return, disallowed accounts, cross-patrol restrictions and cancelled login using a simulated Supabase server.

These tests do not prove that the live Google/Supabase provider or RLS settings have been applied. Live validation requires the public project configuration, the Google provider already configured by the owner, the app URL on Supabase's redirect allowlist, and a deployed build.
