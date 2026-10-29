# Durable badge artwork API

`functions/badge-images.mjs` is a Netlify Functions v2 web handler. `@netlify/blobs` receives the current site's context automatically in deployed Functions. The store is site-wide and uses strong consistency. Files are immutable by badge/content hash; a conditional pointer update chooses the current image. Nothing is stored in the build/deploy directory and no cleanup code deletes prior image versions.

Public GET requests expose only badge artwork. PUT requests require a bearer token verified through Supabase `/auth/v1/user`, followed by a query of the existing `patrol_access` table using the same token. A valid session with no approved patrol grant is refused. No email or role supplied by the browser is trusted.

Images are limited to PNG/JPEG/WebP of 3 MB, checked against their file signature and stored with a fixed MIME type plus `nosniff`. Invalid badge IDs and versions are rejected. Compare-and-set metadata writes protect against simultaneous replacement; stale uploads return 409. Errors return a safe message without logging bearer tokens or provider responses.

The real Netlify Blobs service is not accessible from a plain Vite server. Local UI tests simulate this endpoint; unit tests exercise the actual handler and authorization logic with injected storage/fetch. Netlify deployment automatically creates/binds the store on use. Check the in-app saved status once deployed to confirm live storage access. No new Supabase SQL is needed for this feature.

# Public photographer albums

`functions/photographer.mjs` stores public patrol event albums in site-wide store `nexus-photographer-v1`, independent of deployments. No Supabase bucket, SQL or credentials are needed for these albums. Anonymous visitors can create events and read photos, as requested. Uploads do not alter the protected badge-cover API or private patrol records.

Each immutable event is one atomic JSON blob with title, date and 1–4 compressed images, plus a small gallery summary in its metadata. The server enforces patrol indices, valid UUID/date/title, image signatures, 450 KiB per image and a streamed 2.6 MB request limit. The browser resizes to at most 1600 pixels wide, re-encodes JPEG without camera metadata and targets less than 440 KiB per photo. It accepts source JPEG/PNG/WebP up to 15 MB. Native HEIC files must be converted to JPEG first.

UUIDs and conditional create-only writes make retries idempotent; a lost success response does not duplicate an event. Anonymous visitors cannot replace existing events or delete albums. Public GET serves images with fixed MIME and `nosniff`. A same-origin check and Netlify IP/domain rate limiting bound ordinary abuse; there is intentionally no login gate. Netlify's platform enforces the rate limit after deployment, not in the unit-test handler. Storage and bandwidth count against the existing site's Netlify plan.

Gallery reads fetch 20 metadata records at a time. The SDK lists keys internally before app pagination; very large archives may eventually need a dedicated indexed database. Each patrol has a recoverable local IndexedDB composition draft; publishing succeeds only after storage acknowledges the event. Cloud gallery contents are independent of local JSON imports and do not appear inside those app snapshots.

Unit tests exercise the real handler with injected persistent storage. Browser tests invoke the real handler through Playwright routing and simulate a lost publish response, reload, a fresh browser, patrol isolation, compression, four-photo limits and mobile viewing. The cloud environment cannot access the live Netlify domain; confirm the deployed saved status and gallery on another browser to verify the real store binding.

## Admin deletion of photographer events

DELETE `?patrol=<0–5>&event=<uuid>` requires a bearer session verified against Supabase `/auth/v1/user`. Only confirmed accounts `gsvnsdl2006@gmail.com` and `troupeoriongsvn@gmail.com` are accepted. Anonymous users, patrol accounts, forged email headers and unconfirmed emails cannot delete. No new SQL or storage credentials are required.

After confirmation, deletion conditionally replaces the complete event/image payload with a tiny tombstone, removes it from gallery metadata and returns 404 for its photos. A delayed anonymous publish retry cannot resurrect it. The UI removes an event only after the server acknowledges deletion. Images now use `Cache-Control: no-store` so future loads check deletions; images previously downloaded or cached with the old immutable policy cannot be remotely erased from visitors' devices.

Albums are stored as JSON with base64 images: four maximum-size 450 KiB photos use approximately 2.4 MB on disk, around 400 full albums per decimal GB. Actual storage and transfer allowances depend on the site's current Netlify plan and account usage. Inspect the site’s Blobs panel for `nexus-photographer-v1` and the team's Usage & billing page for its quota; the app does not claim to know the owner's remaining plan allowance.

## Separate album viewing from upload throttling

Public GET remains at `photographer.mjs` without the function-level upload rate limit. POST/DELETE on that legacy URL redirect with HTTP 307 to `photographer-write.mjs`, which retains the real handler, the same site-wide store, admin deletion checks and an IP/domain mutation rate limit (40 calls/minute). Photo viewing across browsers or scouts sharing a network no longer consumes that mutation allowance. Existing album URLs and data remain valid. The client gives an explicit 429 message and preserves drafts when writes are throttled.

# Patrol support spaces

`patrol-support.mjs` serves public kit lists, case-study attachments and equipment. It redirects mutations with method preservation to `patrol-support-write.mjs`, which uses the site-wide `nexus-patrol-support-v1` store and a separate IP/domain write rate limit. Keys are scoped by validated section (`kit`, `cases`, `equipment`), patrol index and UUID. Incident reports never use this endpoint.

Kit creation/editing and case-study uploads are public, matching the requested member access model. Equipment mutations require `authorizeLeader`, which verifies the bearer session through Supabase and accepts only the two confirmed admin emails. Public readers and ordinary patrol accounts cannot add equipment or alter its quantity/photo.

Files have a streamed request bound, a 3 MiB binary limit and checked PDF/Word/image signatures; executable HTML/SVG content is refused. Case-study files are immutable and served as attachments with fixed MIME, `nosniff` and encoded filenames. Equipment images use the existing JPEG/PNG/WebP signature checks and a 450 KiB limit. Conditional ETag writes and explicit record versions protect updates; an identical retry is idempotent. Metadata excludes binary payloads and large kit contents; kits fetch their full JSON contents when listed. Public lists are paginated 20 records at a time. All data remains outside deployment output and counts toward the existing site's Netlify usage.

The unit tests exercise the real handler and admin verifier with injected storage. Browser tests cover anonymous kits/studies, actual downloads, device-local incident drafts and DOCX/PDF generation, both admins and a denied patrol account, and fresh-browser equipment photos. These tests do not provision the production Netlify store; Netlify binds it automatically when the deployed functions first run.

## Equipment catalogue defaults

`lib/equipment-catalogue.js` supplies the owner's 37-item screenshot catalogue. Defaults are virtual baseline records scoped to each patrol, with stable UUIDs and versions. There is no anonymous bulk write/import endpoint. Reads overlay existing patrol records and omit a default if an existing record has the same ID or normalized name. Only an authenticated admin can materialize or change an override; the existing create/ETag checks protect that first edit and later changes. Seed photo IDs are derived on the server, preserve the reference image after a rename, and are never trusted from client JSON.

Null quantities are allowed only for equipment (Ficel has no quantity); first-aid kit contents still require integer quantities. Reference photo files are immutable repository assets displayed with explicit thumbnail clips. Source quantity totals, spellings and per-patrol isolation are covered by unit and browser tests, including preservation across a fresh handler/deployment and future equipment additions.
