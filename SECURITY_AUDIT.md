# Audit de sécurité — ASBL LAS
Date : 19 novembre 2026
Dépôt examiné : https://github.com/MASTOR1422/plateform_Asbl_LAS
Branche de travail : audit/security-hardening-2026-11

## Périmètre et méthode
Examen statique des fichiers `index.html`, `README.md` et `.gitignore`.
Le fichier `las-members.sqlite` est présent dans le dépôt. Son contenu n'est pas reproduit dans ce rapport afin de ne pas exposer les données personnelles qu'il pourrait contenir.
Aucun test d'intrusion, test dynamique, vérification de configuration GitHub Pages ou audit exhaustif de l'historique Git n'a été réalisé.

## Résumé exécutif
**Risque global : CRITIQUE tant que le portail utilise une base SQLite distribuée au navigateur.**

### Constatations

1. **CRITIQUE — Base de données livrée au navigateur**
   - `index.html` récupère `las-members.sqlite` par `fetch(DB_FILE)`.
   - La base est donc téléchargeable par les visiteurs du site qui peuvent atteindre ce fichier, indépendamment de l'écran de connexion.
   - Les données personnelles et les empreintes de mots de passe qui s'y trouvent doivent être considérées comme potentiellement exposées.
   - Mesure : suspendre l'exposition de cette base et migrer les données vers un stockage serveur privé. Ne pas simplement compter sur un dépôt privé : un site GitHub Pages publié reste accessible publiquement.

2. **ÉLEVÉ — Authentification et autorisations côté client**
   - La vérification du mot de passe, la session et les fonctions `canEdit()`, `canPay()`, `canSeeSensitive()` et `isAdmin()` sont exécutées dans le navigateur.
   - Le navigateur et son stockage ne constituent pas une frontière de sécurité. Un utilisateur peut modifier l'état JavaScript ou les données de session.
   - Mesure : déplacer l'authentification, les contrôles de rôle et toutes les opérations de lecture/écriture vers une API serveur. Chaque endpoint doit vérifier l'identité et la permission à chaque requête.

3. **ÉLEVÉ — Comptes de démonstration publiés dans README**
   - Le README contient des identifiants et mots de passe de démonstration.
   - Mesure : considérer ces mots de passe comme compromis, désactiver/supprimer ces comptes et en créer de nouveaux après migration. Ne jamais réutiliser ces secrets.

4. **ÉLEVÉ — Modèle de sauvegarde et d'écriture manuel**
   - Les modifications sont faites en mémoire, puis exportées et commitées dans Git.
   - Cela augmente le risque de fuite, d'écrasement concurrent, de perte de données et d'historisation durable des informations personnelles.
   - Mesure : persistance serveur, sauvegardes chiffrées et testées, journal d'audit des opérations.

5. **MOYEN — Dépendances chargées depuis des CDN**
   - sql.js, Google Fonts et Font Awesome sont chargés depuis des fournisseurs externes. Aucun contrôle d'intégrité SRI n'est visible pour ces scripts.
   - Mesure : épingler et contrôler les dépendances, ajouter SRI lorsque possible ou les héberger de manière maîtrisée.

## Corrections de précaution dans cette branche
- Ajout de cet audit et d'un avertissement visible sur l'écran de connexion.
- Le code métier et la base ne sont pas supprimés ni remplacés dans cette première étape afin de ne pas provoquer une panne silencieuse ou une perte de données.
- Cette branche n'est pas une correction complète et ne doit pas être considérée comme prête pour la production.

## Plan de remédiation recommandé

### Étape 0 — Contenir l'exposition
- Vérifier qui peut accéder au dépôt et au site publié.
- Retirer la base de données des artefacts publics après avoir réalisé une sauvegarde contrôlée et validé un plan de migration.
- Désactiver les comptes de démonstration et réinitialiser les mots de passe.
- Si la base a été publique, considérer les données comme divulguées ; supprimer un fichier du dernier commit ne l'efface pas de l'historique Git ni des copies déjà téléchargées.

### Étape 1 — Migration serveur
- Déployer une API authentifiée (Cloudflare Workers) et une base D1 privée, ou une architecture serveur équivalente.
- Migrer les données après sauvegarde, inventaire des tables, contrôle d'intégrité et validation des volumes.
- Ne jamais envoyer la base complète au navigateur.

### Étape 2 — Contrôles d'accès
- Authentification serveur, sessions sécurisées, expiration et révocation.
- Autorisations côté serveur par rôle et par ressource.
- Validation stricte des entrées, protection CSRF lorsque nécessaire, limitation de débit et journalisation.
- Les membres ne doivent recevoir que les données qui leur sont nécessaires.

### Étape 3 — Validation avant production
- Tests automatisés des rôles (membre, secrétaire, trésorier, administrateur).
- Tests d'accès direct aux endpoints, tests de fuite de données, sauvegarde/restauration et tests de concurrence.
- Revue humaine du diff et validation fonctionnelle par LAS avant fusion et déploiement.

## Limites et décisions en attente
- La base SQLite n'a pas été ouverte ni copiée dans ce rapport pour préserver la confidentialité.
- Le statut exact de la configuration Pages, les règles de protection de branche et l'historique complet n'ont pas été vérifiés.
- Aucun fichier de données n'a été supprimé et aucun déploiement n'a été déclenché.
- Le choix final de l'architecture cible doit être confirmé avant la migration destructive ou la modification du flux de production.
