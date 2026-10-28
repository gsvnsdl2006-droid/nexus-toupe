# Google sign-in for the approved troop addresses

No Resend account, SMTP service, DNS records or email-code templates are required. This login verifies identity only. Word/Excel files are still downloaded and uploaded to Drive manually.

## Completed by the owner

- The Supabase project was created and `setup.sql` was run successfully.
- Google sign-in was enabled in Supabase.
- Supabase's callback URL was added to the existing Google OAuth client.
- The Google client ID and client secret were saved directly in Supabase. Never put that secret in this repository or the frontend.

## Remaining site connection

1. In Supabase → Authentication → URL Configuration, set **Site URL** to `https://nexustroupeorion.netlify.app/`. Add that same address to **Redirect URLs** and save. This is the app address, not Supabase's Google callback URL.
2. Retrieve the **Project URL** and **public Publishable key** (or public legacy anon key). These public identifiers may be supplied to the developer to fill in `src/project-config.js`, or configured as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Netlify. Build-time variables take precedence. Never supply a secret/service_role key or database password.
3. Deploy the updated app. Treasury and secretariat show **Continue with Google** when configured. After sign-in, the app returns to the selected patrol and keeps the Supabase session; it does not request Google Drive permissions.
4. Verify an approved leader, a patrol account and an unapproved Google account. The database policies from `setup.sql` remain responsible for granting access: sign-in alone is not permission to read another patrol.

The configuration warning remains visible until the public project identifiers are supplied. The access restrictions must not be called active before deployment and a live check on the configured Supabase project.
