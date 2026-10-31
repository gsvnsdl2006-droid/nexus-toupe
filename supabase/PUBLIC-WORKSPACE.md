The access rules for this update are:

| Section or data | View | Edit |
| --- | --- | --- |
| Members, progression, badge photos, catalogue, logos, photographer, first aid and equipment | Anyone with the link | Anyone with the link; no account required |
| Trésorier | Two troop admins and that patrol's assigned email | Same assigned accounts |
| Secrétariat, attendance and camp dossiers | Two troop admins and that patrol's assigned email | Same assigned accounts |

Existing administrative deletion protections remain separate from ordinary edits.

To activate the update:

1. Open the existing Supabase project and its SQL Editor.
2. Create a new query, paste the complete contents of
   [public-workspace.sql](public-workspace.sql), and run it once. Do not rerun
   setup.sql or create a replacement project. Existing data and patrol_access
   assignments are preserved. The migration can safely be run again.
3. Merge the reviewed application changes into the existing Netlify site's
   deployment branch. Keep its existing site and Blobs stores. Deploy with the
   existing netlify.toml, including the functions, not only the dist folder.
4. After Netlify reports Published, reload the site on both devices. In a private
   browser window, verify members and a public edit appear on another device
   without signing in. Verify Trésorier and Secrétariat still ask for an assigned
   account; an unrelated Google account must remain blocked from those sections.

The migration exposes a filtered public view containing only members and
first-aid incident reports. Its save function updates only those fields and uses
the shared record revision to prevent overwriting simultaneous changes. Treasury,
meetings, attendance and camp dossiers keep their existing table RLS policies.
Other public sections continue using the existing site-wide Netlify Blobs stores.

Without the SQL migration, the application keeps its previous account-based
member loading; deploying frontend changes alone does not activate shared public
members. No service-role key or new secret belongs in the frontend or this setup.
