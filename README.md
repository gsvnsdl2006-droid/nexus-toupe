# Nexus · Troupe Orion

French, responsive patrol workspace for Goélands, Lions, Guépards, Orcs, Renards and Taureaux. React + Vite; Node 22.12+ or 24 recommended.

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

Playwright is configured for `/usr/bin/chromium` in the cloud environment. Set a different executable in `playwright.config.js` on another machine. The browser tests expect the dev server to be running. Build output is `dist/`; deploy that directory to a static host with HTTPS. No backend or application secrets are required for local operation.

## What works

- Independent cashflow workbooks per patrol with the original four activity tabs, income, expense and net cash totals; Excel export.
- Camp workbook editor using the actual supplied 15-tab SVP template; each patrol's changes are independent. A–O and up to 200 rows are editable. Workbook export retains the template cell content and worksheets; advanced Excel styling, drawings and embedded objects are not guaranteed by the workbook library. Original files are always available unchanged under `public/templates/` and in Settings.
- Members entered once, dated meetings with editable reports and attendance stored together, attendance statistics which exclude meetings where the member was not yet listed.
- Four progression stages plus the 93 badge names supplied by the troupe (no prices or brevets de capacités), individual notes and up to three photos per accomplishment.
- IndexedDB persistence, full JSON export/import, and configurable header logos. Uploaded chat images are not exposed as files in this workspace; the initial header uses provisional vector/text marks. Add the supplied logo image files through Archives & Drive → Les couleurs de la troupe.
- Self-hosted bundled fonts; no runtime font CDN dependency.

## Google Drive connection

Being signed into Gmail or another web app does not configure this app's OAuth client. Use `gsvnsdl2006@gmail.com` in the Google connection dialog if that is the archive owner.

1. In Google Cloud, create or reuse a **Web application OAuth client**, enable **Google Drive API**, configure the OAuth consent screen and add intended users if the app is in testing.
2. Add the exact deployed app origin (and the local development origin when testing) under **Authorized JavaScript origins**. This uses the Google Identity Services token flow and requires no client secret or redirect endpoint.
3. Paste the public client ID into Archives & Drive, then Connecter Google. The client ID is saved in this browser; access tokens remain in memory only. The app requests only `drive.file` access to files created/opened by this application.
4. Select **Tout archiver dans Drive**. It creates a `Nexus Troupe Orion` folder with six patrol subfolders, each containing a converted Google Sheets cashflow workbook, a converted camp workbook, Google Docs meeting reports including attendance, and progression photos/JSON. A complete `nexus-backup.json` at the root supports restore, including photos and logo configuration.
5. On another browser, connect the same Google account and choose **Restaurer** before editing. Export local work before replacing data.

**Current boundary:** Drive synchronization is explicit, not automatic or real-time collaboration. Sync uploads the current local state and overwrites corresponding Drive files. There is no concurrent-user merge, role-based authorization, or secure member login: selecting a member name opens a notebook. Do not use this version as a public shared multi-user system for private youth records. For that workflow, add server-side authentication, patrol permissions and conflict-safe shared storage before rollout. Local browser data can be lost when browser storage is cleared: archive/export regularly. Deleting an item locally does not delete existing historical Drive files. Existing OAuth access in another app cannot be imported by this one.

## Validation and deployment

Unit tests cover cashflow aggregation, patrol isolation and attendance denominators. Browser tests exercise members, cashflow, linked reports/attendance, progression/photos, reload persistence, camp edits, and mobile viewport bounds. Live Google OAuth and API operations need the configured client and user consent and cannot be verified just by a successful build. The tests do not claim that external integration works before that step.

Publishing the source to GitHub does not deploy the app or create a Google Drive archive. Deploy through Netlify, then configure the OAuth origin and connect Drive in the app.
