# ASBL Les Amis de la Semence — Portail Node.js + SQLite

Portail web public pour les annonces et événements, avec espace membre protégé par identifiant et mot de passe.

## Architecture

- Node.js 22+, Express 5 et SQLite (better-sqlite3).
- Aucun Cloudflare, Supabase ou Vercel.
- Données persistantes dans data/, photos dans storage/photos/, documents dans storage/documents/.
- Ces répertoires sont privés, hors de public/ et exclus de Git par .gitignore.
- Les fichiers téléversés ne sont jamais commités dans le dépôt.

## Installation sur un serveur classique

Prérequis : Node.js 22+, npm et un serveur disposant d'un disque persistant.

```bash
git clone https://github.com/MASTOR1422/plateform_Asbl_LAS.git
cd plateform_Asbl_LAS
git checkout migration/node-sqlite-public-portal
npm install
cp .env.example .env
```

Définir dans .env un secret de session aléatoire d'au moins 32 caractères, puis configurer les chemins LAS_DATA_DIR, LAS_DB_PATH et LAS_STORAGE_DIR sur un volume persistant et sauvegardé. En production, utiliser HTTPS avec un reverse proxy et définir TRUST_PROXY=1 uniquement si l'application est derrière un proxy de confiance.

Initialiser la base et les fiches initiales :

```bash
npm run db:init
```

Créer le premier administrateur (choisir son propre identifiant et un mot de passe long) :

```bash
npm run admin:create -- admin "Administrateur LAS" "RemplacerParUnMotDePasseLong!"
```

Ne jamais publier le mot de passe, le fichier .env, data/las.sqlite ou le contenu de storage/.

Démarrer avec npm start. L'application écoute sur le port fourni par PORT (3000 par défaut). Le site public s'ouvre à la racine ; le bouton « Espace membre » ouvre la connexion.

## Fiches des membres

Une fiche contient uniquement le nom complet, le numéro de téléphone et une photo de profil facultative. Le répertoire est consultable par les membres connectés et la recherche porte sur le nom. L'administrateur et le secrétaire peuvent créer et modifier les fiches ; seul l'administrateur peut les supprimer. Un membre peut téléverser ou remplacer sa propre photo, sans modifier les coordonnées d'un autre membre. Formats photo : JPEG, PNG et WEBP, 5 Mo maximum.

La liste de départ est dans db/seed-members-from-las-list.sql. Les graphies et numéros doivent être vérifiés par LAS avant une première initialisation réelle.

## Rôles

- Administrateur : gestion des comptes, fiches, documents, publications et cotisations.
- Secrétaire : gestion des fiches et publications.
- Trésorier : cotisations et contributions de tontine.
- Membre : consultation du répertoire, documents autorisés, tontine personnelle et mise à jour de sa propre photo.

## Sauvegardes et exploitation

Sauvegarder régulièrement la base SQLite et le dossier storage/ ensemble. Conserver les sauvegardes hors du serveur principal et tester leur restauration. Le disque d'hébergement doit être persistant : un hébergement éphémère peut effacer la base et les photos lors d'un redéploiement.

Ne pas utiliser de données réelles avant d'avoir configuré HTTPS, le secret de session, les sauvegardes et un hébergement avec stockage persistant.
