# Durable badge artwork API

`functions/badge-images.mjs` is a Netlify Functions v2 web handler. `@netlify/blobs` receives the current site's context automatically in deployed Functions. The store is site-wide and uses strong consistency. Files are immutable by badge/content hash; a conditional pointer update chooses the current image. Nothing is stored in the build/deploy directory and no cleanup code deletes prior image versions.

Public GET requests expose only badge artwork. PUT requests require a bearer token verified through Supabase `/auth/v1/user`, followed by a query of the existing `patrol_access` table using the same token. A valid session with no approved patrol grant is refused. No email or role supplied by the browser is trusted.

Images are limited to PNG/JPEG/WebP of 3 MB, checked against their file signature and stored with a fixed MIME type plus `nosniff`. Invalid badge IDs and versions are rejected. Compare-and-set metadata writes protect against simultaneous replacement; stale uploads return 409. Errors return a safe message without logging bearer tokens or provider responses.

The real Netlify Blobs service is not accessible from a plain Vite server. Local UI tests simulate this endpoint; unit tests exercise the actual handler and authorization logic with injected storage/fetch. Netlify deployment automatically creates/binds the store on use. Check the in-app saved status once deployed to confirm live storage access. No new Supabase SQL is needed for this feature.
