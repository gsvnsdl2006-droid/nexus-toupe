# Nexus · Troupe Orion

Application en français, mobile, pour Goélands, Lions, Guépards, Orcs, Renards et Taureaux. Node 24 recommandé.

## Démarrage

```sh
npm ci --cache /tmp/nexus-npm-cache
npm run dev -- --port 5173
npm run build
npm test
npx playwright test
npx playwright test --config playwright.access.config.js
```

Playwright démarre le serveur de développement automatiquement et utilise `/usr/bin/chromium`. Pour tester une compilation déjà servie : `TEST_BASE_URL=http://127.0.0.1:4173 npx playwright test`. Netlify compile avec `npm run build` et publie `dist/`.

## Sauvegarde et exports manuels

**Aucune connexion Google Drive ni synchronisation Drive.** L'ancienne intégration OAuth a été retirée. Le jeton de l'ancienne session est effacé au chargement. Les anciens fichiers Drive ne sont pas supprimés.

Les saisies sont enregistrées sur l'appareil dans IndexedDB. Les rapports de réunion se téléchargent en **véritables fichiers Word .docx**, avec le rapport et le tableau des présences. Les présences se téléchargent aussi en **Excel .xlsx**, pour une réunion ou l'ensemble des réunions. L'utilisateur dépose lui-même les fichiers sur son Drive.

La trésorerie affiche les dollars américains ($). Les classeurs Excel ont titres, totaux calculés, formats monétaires, tableaux filtrables et lignes alternées. Les dossiers de camp utilisent dix catégories avec exports Excel mis en page, couleurs de troupe, texte renvoyé à la ligne et réglages d'impression. Les anciennes cellules du modèle original restent exportables séparément.

Chaque membre peut recevoir une photo. Chaque badge/étape peut recevoir une image propre, distincte des photos de ses réalisations. Les données, images et logos sont inclus dans l'export JSON complet (Archives & exports). Importer cet export sur un autre appareil permet de reprendre les carnets. Les fichiers Excel/Word ne remplacent pas la sauvegarde JSON des images.

## Restriction par e-mail — activation à terminer

La connexion Google via Supabase vérifie l’adresse et mémorise la session. Elle est distincte de Google Drive : aucun code e-mail, SMTP, Resend ou accès Drive n’est nécessaire. Les règles RLS protègent les données distantes de trésorerie/secrétariat. Voir [supabase/README.md](supabase/README.md) et exécuter [supabase/setup.sql](supabase/setup.sql).

Les deux maîtrises confirmées sont prévues dans le SQL : `gsvnsdl2006@gmail.com` et `troupeoriongsvn@gmail.com`. Les six adresses de patrouille confirmées sont également dans le SQL. La configuration publique du projet Supabase est maintenant intégrée dans `src/project-config.js`. Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` restent des surcharges optionnelles. Aucune clé secret/service_role ne doit apparaître dans le frontend.

**Sans cette configuration, la restriction n'est pas active.** Un message l'indique dans les deux sections ; l'application conserve le mode local. Une fois configurée, une connexion Google vérifiée et une entrée d'accès côté base sont nécessaires : saisir simplement une adresse ne donne pas accès. Les clients ne peuvent pas modifier les autorisations. Les anciennes copies locales et exports ne sont pas chiffrés ou effacés par la nouvelle protection. La progression reste locale sans connexion.

## Validation

Les tests couvrent l'isolation des patrouilles, les taux de présence, la lecture effective des classeurs exportés (données, formules, styles), les rapports Word, les photos, la persistance et l'affichage mobile. L'accès réel par e-mail doit être validé sur un projet Supabase configuré, avec les politiques RLS appliquées et l'envoi de codes opérationnel ; aucun test local ne prouve à lui seul cette activation.

Les tests Playwright lancent Vite en mode `test`, qui utilise un projet local vide ou un serveur Supabase simulé ; ils ne contactent pas le projet de production. La compilation normale utilise les identifiants publics fournis par le propriétaire.

## Codes scouts

La section Codes reprend le même moteur que `gsvnsdl2006-droid/nexus-ai-gsvn`, référence `97084fad448dadc77aa5baaa18127f7840cf1b64` (`assets/codes.mjs`). Elle est accessible depuis l’accueil et depuis chaque patrouille sans connexion utilisateur : Morse international, alphabet numéroté avec clé personnalisable (ex. C=9), substitution de lettres (ex. A=K), alphabet inversé Atbash, codage/décodage instantané, tableau complet de correspondances, copie et téléchargement texte. Les accents sont normalisés et les caractères non pris en charge sont conservés et signalés. Le brouillon reste dans l’onglet via sessionStorage. Aucun service d’IA ni nouvelle autorisation n’est requis.

## Suppression des membres et réunions

Seuls `gsvnsdl2006@gmail.com` et `troupeoriongsvn@gmail.com` peuvent supprimer un membre ou une réunion. Activer une fois la règle côté base en exécutant [supabase/leader-deletion.sql](supabase/leader-deletion.sql) dans le SQL Editor du projet existant. Les boutons restent désactivés tant que cette migration n’est pas installée. Les anciennes présences et le nom d’un membre supprimé sont conservés dans les réunions historiques et leurs exports. Une réunion supprimée ne compte plus dans les statistiques. Les tests PostgreSQL vérifient également le refus d’une suppression par un compte de patrouille via une mise à jour directe du JSON.

## Badge photos that survive deployments

Badge covers now have an independent local image vault and a versioned **site-wide Netlify Blobs** backup (`nexus-badge-images-v1`). The function uses Netlify's automatically supplied server-side Blobs context; no new service key, SQL migration or separate account is needed. It intentionally uses `getStore`, not deploy-specific storage. The frontend never receives a Netlify storage token.

The same production origin keeps its IndexedDB vault through normal redeployments. On load/import, existing vault images are merged back rather than removed by an older JSON snapshot. Existing base64 badge covers are automatically migrated into the vault. Old images that have already disappeared from browser storage and were never backed up cannot be reconstructed by a deployment; recover them from a prior JSON backup or upload them once again.

An approved, signed-in troop account automatically backs up pending badge covers. The server validates the Supabase session with Supabase and checks the existing RLS-protected access list before accepting an upload. Anonymous visitors can view the shared badge artwork but cannot overwrite it. Badge artwork is public progression content; private member images are not published by this endpoint. Existing member photographs continue to use their protected Supabase patrol record when that record is saved by an authorized user.

The interface distinguishes a local copy, pending upload, successful permanent backup and failure. Offline copies are retained, with retry on reconnection/focus and bounded retries. Every badge has an independent immutable image version; optimistic head updates prevent a stale image from silently replacing someone else's cover. Different versions remain stored. A conflict keeps the local copy and can be resolved explicitly with « Sauvegarder cette version »; other badge uploads continue. Local JSON imports preserve images already in the vault. Archives & exports includes local recovery and remote-backup checks.

Use the same Netlify site for future deployments. Deleting the site/store or deploying under a different site identity is not the same as redeploying the existing site. The live Blobs upload must be confirmed by the in-app permanent-backup status after Netlify deploys; local tests use a simulated store/API.

## Progression dashboard and badge souvenirs

Selecting a member displays a percentage ring and counts for 93 badges: completed, documented/in progress, and remaining. Completion is explicit (« Marquer comme terminé »); adding notes alone does not complete a badge. Promesse, 2nde classe, Première classe and Raider have separate completion indicators. These records remain in the member's local patrol data and full JSON backups.

Each member can download a designed, personalized badge PDF with the badge title, name, patrol, completion date, selected cover, notes and selected achievement photos. Notes and images can be included independently. Long journals paginate; browser-rendered text preserves accents and the browser's font shaping. The PDF is a visual keepsake, with rendered page images, and can be kept outside the app. Its generated filename includes the badge and member names.

## Phone home-screen icon

The web manifest and iOS touch icon use the green Nexus/Orion artwork: Nexus lettering, the Orion archer replacing the central cross, and green orbital accents. Android has a separate padded maskable icon. Existing saved shortcuts may retain an OS-cached icon: remove and add the shortcut again to pick up the new artwork. The manifest does not claim offline app startup; it supplies shortcut branding and standalone display.

## Public photographer albums and camp deletion

**Photographe**, before Codes, is public on the home page and in every patrol. Anyone can publish an event/date and 1–4 photos without signing in. Albums use the existing site's Netlify Blobs store outside deployment files; source images are compressed, local drafts survive reloads and retrying a publication cannot overwrite an existing album. See [netlify/README.md](netlify/README.md) for storage, API, pagination and live-verification details. No new setup is required for photo albums.

The two troop admins can also delete simplified camp dossiers and the legacy camp workbook. Enable the server protection once with [supabase/camp-deletion.sql](supabase/camp-deletion.sql) in the existing Supabase SQL Editor. The app offers the same SQL file for download and keeps deletion disabled until the server verifies the guard. No API keys or Google provider changes are needed.
