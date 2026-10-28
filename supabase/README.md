# Protection de la trésorerie et du secrétariat

Cette configuration n'utilise pas Google Drive. Elle utilise un code e-mail Supabase, une session mémorisée et des règles d'accès côté base de données (RLS).

## Activation requise

1. Créer un projet Supabase. Dans Authentication → Providers → Email, activer la connexion par e-mail. Dans Authentication → Email Templates, adapter **Confirm signup** et **Magic Link** pour afficher le code `{{ .Token }}` (le texte peut dire « Votre code Nexus : {{ .Token }} »). Configurer l'envoi des e-mails/SMTP pour la production et les utilisateurs prévus ; le service d'essai peut limiter les destinataires et le débit.
2. Exécuter `setup.sql` dans SQL Editor. Les deux maîtrises confirmées sont déjà prévues : `gsvnsdl2006@gmail.com` et `troupeoriongsvn@gmail.com`.
3. Les six adresses de patrouille sont déjà enregistrées dans le SQL avec les deux maîtrises : exactement trois autorisations par patrouille. Vérifier les noms/adresses avant d’exécuter le fichier. Les clients ne peuvent pas modifier cette liste.
4. Dans Netlify → Environment variables, ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` (clé publique publishable ou anon). Ne jamais utiliser de clé secret ou service_role dans une variable `VITE_*`.
5. Relancer le déploiement Netlify. Les variables sont intégrées à la compilation.
6. Tester avec une maîtrise, l'adresse d'une patrouille et une adresse non autorisée. Vérifier aussi directement les requêtes REST : une adresse non autorisée ne doit recevoir aucune ligne protégée.

Les instructions SQL ne sont pas appliquées par le simple déploiement GitHub. Tant que les variables ne sont pas configurées, l'application affiche explicitement que la restriction n'est pas active et reste en mode local. Ne pas présenter cette phase comme un espace privé opérationnel.

## Données et limites

Une fois configurées, les deux sections sont bloquées aux visiteurs non authentifiés. Après connexion, Supabase charge uniquement les lignes autorisées par RLS. Les modifications des membres, réunions, présences, camps et transactions sont copiées dans `patrol_records`, avec une révision pour refuser les écrasements concurrents. La progression reste locale et ne demande pas de connexion.

La première sauvegarde d'un espace distant encore vide importe la copie locale de la patrouille. Les trois dernières copies locales différentes sont conservées automatiquement avant le chargement de données distantes. La plus récente est téléchargeable dans Archives & exports de la patrouille (« Télécharger la copie locale avant connexion »). Exporter aussi une sauvegarde JSON complète avant la mise en service. Un appareil qui possédait déjà les anciennes données les conserve : cette nouvelle connexion ne chiffre ni n'efface les anciennes copies locales, téléchargements ou archives Drive. Les exports manuels et sauvegardes JSON peuvent contenir des données privées ; ils restent sous le contrôle de leur détenteur.

Aucun test d'intégration contre un vrai projet Supabase n'a été effectué sans URL/clé et configuration d'envoi e-mail. Les politiques RLS doivent être appliquées et vérifiées avant d'annoncer que la restriction est active.

## Tests locaux

`npx playwright test --config playwright.access.config.js` vérifie les écrans avec un serveur Supabase simulé : connexion vérifiée sans autorisation refusée, et compte de patrouille limité à sa patrouille. Cela ne remplace pas la vérification des règles RLS sur le vrai projet.
