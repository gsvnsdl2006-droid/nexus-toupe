# Activer les accès par e-mail

Les fichiers Word/Excel se téléchargent et se déposent manuellement sur Drive. Cette configuration sert uniquement à protéger et partager la trésorerie et le secrétariat.

1. Ouvrir https://supabase.com/dashboard et créer un compte (ou se connecter).
2. Cliquer **New project**. Choisir une organisation, nommer le projet **Nexus Troupe Orion**, créer un mot de passe de base de données et le conserver en privé. Choisir la région souhaitée, puis **Create new project**. Attendre que le projet soit prêt.
3. Ouvrir **SQL Editor → New query**. Copier le contenu du fichier `supabase/setup.sql` de ce dépôt et cliquer **Run**. Il crée les règles de sécurité et ajoute les huit adresses confirmées : deux maîtrises avec accès aux six patrouilles, et une adresse pour chaque patrouille.
4. Dans **Authentication → Sign In / Providers → Email**, activer la connexion e-mail. Dans les modèles **Confirm signup** et **Magic Link**, utiliser le code `{{ .Token }}` dans le contenu du message, par exemple « Votre code Nexus : {{ .Token }} ». Le nom exact des menus peut varier selon la version du tableau de bord.
5. Configurer l’envoi des e-mails pour les huit utilisateurs. Le service d’essai Supabase peut limiter l’envoi aux membres de l’organisation et imposer un débit faible ; ajouter un fournisseur SMTP dans les paramètres e-mail si nécessaire avant de tester les huit comptes.
6. Dans les paramètres du projet, copier **Project URL** et la clé **Publishable** (ou l’ancienne clé publique **anon**). Ne jamais copier une clé **secret** ou **service_role** dans le frontend.
7. Dans Netlify → projet Nexus → **Environment variables**, ajouter :
   - `VITE_SUPABASE_URL` : Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publique Publishable/anon
8. Relancer le déploiement Netlify pour intégrer ces paramètres à la compilation.
9. Tester l’accès avec une maîtrise et chaque adresse de patrouille. Vérifier qu’une patrouille ne peut pas ouvrir une autre patrouille et qu’un autre e-mail n’obtient aucune ligne protégée via l’API. L’application affiche un message indiquant que la protection n’est pas encore active tant que la configuration est absente.

Garder les sauvegardes JSON et les anciens exports : la nouvelle protection ne chiffre ni ne retire les documents déjà téléchargés ou présents sur un appareil.
