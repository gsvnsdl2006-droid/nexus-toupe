# Nexus · Troupe Orion

Dark green, mobile-first patrol workspace for Goélands, Lions, Guépards, Orcs, Renards and Taureaux. React + Vite; Node 22.12+ or 24 recommended.

## Run

```sh
npm ci --cache /tmp/nexus-npm-cache
npm run dev -- --port 5173
```

```sh
npm run build
npm test
npx playwright test
```

Playwright is configured for `/usr/bin/chromium` in the cloud environment. Set a different executable in `playwright.config.js` on another machine. Browser tests start the development server automatically unless TEST_BASE_URL targets an existing production server. Build output is `dist/`; deploy that directory to a static host with HTTPS. No backend or application secrets are required for local operation.

## What works

- Independent cashflow workbooks per patrol with the original four activity tabs, income, expense and net cash totals; Excel export.
- Simplified camp folders with ten clickable categories (general information, team, goals, programme, preparations, contacts, menus, budget, equipment, evaluation). Save a category to update its real `.xlsx` workbook automatically in Drive under the patrol’s `Dossiers de camp/<name> [id]` folder. Download the generated workbook directly from the camp. Existing legacy cell edits are preserved and remain downloadable as an old workbook; the original uploaded templates remain unchanged.
- Visual attendance dashboard: six patrol comparison bars, a per-patrol attendance ring and individual member bars, with exact counts retained underneath. Empty data displays “no attendance” rather than a fabricated rate.
- Members entered once, dated meetings with editable reports and attendance stored together, attendance statistics which exclude meetings where the member was not yet listed.
- Four progression stages plus the 93 badge names supplied by the troupe (no prices or brevets de capacités), individual notes and up to three photos per accomplishment.
- IndexedDB persistence, full JSON export/import, and configurable header logos. The bundled Nexus/Orion header artwork and six patrol pennants are cleaned renderings based on the troupe’s supplied images. Renards intentionally retains the visible dark folded pennant. Patrol slogans and colour accents are built in. Custom header images can still be uploaded in Archives & Drive.
- Self-hosted bundled fonts; no runtime font CDN dependency.

## Google Drive connection

Being signed into Gmail or another web app does not configure this app's OAuth client. Use `gsvnsdl2006@gmail.com` in the Google connection dialog if that is the archive owner.

1. In Google Cloud, create or reuse a **Web application OAuth client**, enable **Google Drive API**, configure the OAuth consent screen and add intended users if the app is in testing.
2. Add the exact deployed app origin (and the local development origin when testing) under **Authorized JavaScript origins**. This uses the Google Identity Services token flow and requires no client secret or redirect endpoint.
3. Paste the public client ID into Archives & Drive, then Connecter Google. The client ID is saved in this browser; the short-lived access token is retained in this tab’s sessionStorage until expiry/disconnection, so refreshing the same tab can resume without opening Settings. It is never stored in localStorage. The app requests only `drive.file` access to files created/opened by this application.
4. **Automatic archiving is always active.** After connection, edits are batched for 2.5 seconds and then uploaded while the app is open. A status chip shows pending/uploaded/offline/reconnect states. An expired Google token pauses uploads and asks you to reconnect; an unexpired tab session reconnects automatically after a page refresh. An inline Connecter Drive button is available throughout the app, including member/meeting/camp flows; opening Settings to save is unnecessary. The archive creates a `Nexus Troupe Orion` folder with six patrol subfolders, each containing a converted Google Sheets cashflow workbook, a converted camp workbook, Google Docs meeting reports including attendance, and progression photos/JSON. A complete `nexus-backup.json` at the root supports restore, including photos and logo configuration.
5. On a fresh browser, connecting the same Google account reads and restores the existing archive before enabling uploads. If both the device and Drive have pending changes, automatic uploading pauses for a version choice. Export local work before replacing data.

**Current boundary:** Drive synchronization is automatic while the app is open, Google is connected, using its unexpired tab session. New members are also archived as a patrol members JSON file. A single upload runs at a time; later edits queue for the next upload. Only changed patrol content is re-uploaded, with a complete JSON backup written last. Network failures retry with backoff (up to three retries) and pending local work survives reloads; returning online resets retry eligibility. A preflight archive-revision check pauses an upload when another device has changed the archive. This is a best-effort conflict check, not an atomic multi-user transaction or real-time collaboration. There is no concurrent-user merge, role-based authorization, or secure member login: selecting a member name opens a notebook. Do not use this version as a public shared multi-user system for private youth records. For that workflow, add server-side authentication, patrol permissions and conflict-safe shared storage before rollout. Local browser data can be lost when browser storage is cleared: check the saved-to-Drive status or export regularly. Deleting an item locally does not delete existing historical Drive files. Existing OAuth access in another app cannot be imported by this one.

## Validation and deployment

Unit tests cover cashflow aggregation, patrol isolation and attendance denominators. Browser tests exercise members, cashflow, linked reports/attendance, progression/photos, reload persistence, camp edits, and mobile viewport bounds. Live Google OAuth and API operations need the configured client and user consent and cannot be verified just by a successful build. The tests do not claim that external integration works before that step. Mocked browser checks cover automatic uploads, edits during an in-flight upload, Google session expiry, restoring a fresh device, creating camp folders and inspecting their actual Excel uploads, and reconnecting after page refresh without revisiting Settings.

Publishing the source to GitHub does not deploy the app or create a Google Drive archive. Deploy through Netlify, then configure the OAuth origin and connect Drive in the app.
