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
