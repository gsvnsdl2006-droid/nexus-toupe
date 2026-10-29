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

## Leader-only member/event deletion

Run `leader-deletion.sql` once in the existing project's SQL Editor, then refresh the app. It changes no existing records or access-list entries. No new project, Google setting or API key is needed.

Only `gsvnsdl2006@gmail.com` and `troupeoriongsvn@gmail.com` see the delete controls. The controls remain disabled until the server confirms that the database deletion guard exists. A PostgreSQL trigger rejects removal or replacement of existing member/event IDs by any other authenticated account, including direct JSON API updates. Normal authorized edits remain allowed. Leaders confirm deletion; removing a member preserves that member's name in historical meeting attendance and Word/Excel attendance exports. Removing a meeting removes its attendance from statistics.

Local PostgreSQL tests execute the actual setup and migration using PGlite, with authenticated JWT claim fixtures and RLS roles. Browser tests cover both leaders, a patrol account and a missing migration. Passing these tests does not apply the migration to the live project.

## Admin-only camp dossier deletion

Run [camp-deletion.sql](camp-deletion.sql) once in the existing project's SQL Editor, then refresh. It preserves all current records and access grants, and adds a separate trigger that rejects removal/replacement of camp dossier IDs or removal of legacy workbook sheets by patrol accounts. Both confirmed troop admins can delete a complete simplified dossier or the legacy workbook after confirmation. Authorized users can still fill in and edit camp fields.

`camp_deletion_enabled()` verifies the caller and the installed trigger. Buttons remain disabled until the server confirms it is installed; member/meeting deletion retains its existing, separate migration. The app supplies a download of the exact SQL at `/setup/camp-deletion.sql`. Database tests run both migrations with real PostgreSQL roles and RLS; those tests do not apply SQL to production.
