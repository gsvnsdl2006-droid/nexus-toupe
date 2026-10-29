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
