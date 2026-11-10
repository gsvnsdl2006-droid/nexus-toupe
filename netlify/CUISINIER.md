# Cuisinier (inside Intendance)

Each patrol has its own public recipe list. Only the two existing confirmed main
admin accounts may create recipes. The write function verifies the actual
Supabase session with the existing `authorizeLeader` helper; browser role flags
are not trusted. Everyone may add an experience, a photo, or both to an existing
recipe without signing in. A contributor name is optional and is not a verified
identity.

Recipes and contributions use the site-wide Netlify Blobs store
`nexus-cuisinier-v1`. The two confirmed main admins may also edit or delete
recipes, with revision checks to reject conflicting edits and a confirmation
before deletion. Editing preserves existing photos and experiences. Deleted
recipes use a tombstone to prevent delayed retries from restoring them; their
contributions remain stored but are no longer publicly accessible.
Contributions remain append-only. Conditional create-only writes make identical
creation retries safe. Existing equipment, workspace,
photographer, treasury and secretary stores and permissions are unchanged.
Photos are re-encoded by the browser and checked on the server for JPEG/PNG/WebP
signatures and a 450 KiB maximum. Lists return 20 records per page. Refresh on
focus, reconnection and every 15 seconds retrieves shared records.

Deploy the frontend and the two new Netlify functions together to the existing
site using the existing `netlify.toml`. Netlify supplies the Blobs context. No SQL
migration, additional secret or new Supabase project is needed. A plain Vite
server does not provide the Netlify API. Unit and browser tests use injected
storage; production Blobs binding and real Google sign-in require a deployed
smoke check. Forms remain open on failed saves, but unsubmitted forms are not
persisted across navigation or reload.
