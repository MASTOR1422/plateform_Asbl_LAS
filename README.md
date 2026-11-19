# ASBL LES AMIS DE LA SEMENCE (LAS) — Portail statique

Portail de gestion des membres et cotisations, **100 % statique**, déployable sur
GitHub Pages. Aucun Supabase, aucun Vercel, aucun backend. La base de données est
un fichier **SQLite** (`las-members.sqlite`) logé dans le dépôt, lu dans le
navigateur via **sql.js** (SQLite compilé en WebAssembly).

## Contenu du dossier

```
las-static-site/
├── index.html              ← application (HTML + CSS + JS, autonome)
├── las-members.sqlite      ← base de données (membres, cotisations, utilisateurs)
├── logo-las.jpg            ← logo officiel LAS
├── 404.html                ← page d'erreur personnalisée
├── .nojekyll               ← désactive Jekyll sur GitHub Pages
└── README.md               ← ce fichier
```

## Déploiement sur GitHub Pages

1. Créez un **dépôt privé** sur GitHub (GitHub Pro nécessaire pour Pages sur un
   dépôt privé — la base contient des données membres : téléphones, adresses,
   dates de naissance).
2. Copiez tout le contenu de ce dossier à la racine du dépôt.
3. **Settings → Pages → Source = Deploy from a branch**, branche `main`,
   dossier `/ (root)`.
4. Ajoutez un fichier `.gitignore` à la racine pour ne pas committer d'autres
   fichiers sensibles (voir plus bas).
5. Poussez. Le site est accessible à `https://<compte>.github.io/<dépôt>/`.

> Le fichier `.nojekyll` est indispensable : sans lui, GitHub Pages traite le
> dépôt avec Jekyll et peut ignorer certains fichiers.

## Authentification

L'authentification est **côté client** (PBKDF2-HMAC-SHA256, 100 000 itérations).
Les utilisateurs et les *hashes* de mots de passe sont stockés dans la table
`users` du fichier `las-members.sqlite`. Comme le dépôt est privé, seuls les
administrateurs du dépôt peuvent lire ces *hashes*.

**Comptes de démonstration (à changer après le premier déploiement) :**

| Rôle        | Identifiant              | Mot de passe   |
|-------------|--------------------------|----------------|
| Admin       | admin@las-asbl.org       | LasDemo2026!   |
| Trésorier   | tresorier@las-asbl.org   | LasDemo2026!   |
| Secrétaire  | secretaire@las-asbl.org  | LasDemo2026!   |
| Membre      | membre@las-asbl.org      | LasDemo2026!   |

### Changer les mots de passe

Ouvrez le portail en admin → icône **Utilisateurs** (bouclier) → créez de
nouveaux comptes avec un mot de passe fort, puis exportez la base (voir
ci-dessous) et re-commitez le fichier. Supprimez ensuite les comptes de démo en
éditant la base (via le script `las-build-sqlite.py` ou en exportant après
suppression).

## Lecture et écriture de la base

- **Lecture** : automatique. Au chargement, le navigateur récupère
  `las-members.sqlite` et l'ouvre en mémoire avec sql.js. Recherches,
  statistiques, répertoire et cotisations fonctionnent immédiatement.
- **Écriture** (admin/trésorier/secrétaire) : les modifications (ajout de
  membre, mois payés, nouvel utilisateur) sont appliquées **en mémoire**.
  Elles ne sont **pas** écrites dans le fichier du dépôt automatiquement.
  L'admin doit :
  1. Cliquer sur l'icône **Exporter la base** (téléchargement) — un bandeau
     orange signale les modifications non enregistrées.
  2. Télécharger le nouveau `las-members.sqlite`.
  3. Le **déposer dans le dépôt GitHub** (interface web : remplacer le fichier
     puis *Commit changes*).
  4. Attendre quelques secondes que GitHub Pages republie, puis recharger le
     portail.

C'est le modèle « Export + commit web » : simple, sans serveur, adapté à une ASBL.

## Régénérer la base de zéro (données de démo)

```bash
python3 scripts/las-build-sqlite.py
```

Ce script recrée `las-members.sqlite` avec le schéma et les données de démo.
Utile pour repartir d'une base propre ou pour modifier les données de départ
(éditez la liste `MEMBERS` dans le script).

## Schéma de la base

- **members** : id, name, poste, phone, email, profession, birthdate,
  birthplace, address, joined, asbl (OUI/NON), forum, status, photo_path
- **member_payments** : member_id, payment_year, payment_month (1-12), paid,
  updated_by, updated_at — clé primaire (member_id, payment_year, payment_month)
- **users** : id, username (e-mail), display_name, role
  (admin/tresorier/secretaire/membre), member_id, salt, password_hash,
  iterations, active, created_at

Cotisation mensuelle : **10 USD**.

## Droits par rôle

| Action                    | Admin | Trésorier | Secrétaire | Membre |
|---------------------------|:-----:|:---------:|:----------:|:------:|
| Lire le répertoire        |  oui  |   oui     |    oui     |  oui*  |
| Coordonnées sensibles     |  oui  |   oui     |    oui     |  non   |
| Ajouter / modifier membre |  oui  |   non     |    oui     |  non   |
| Gérer les cotisations     |  oui  |   oui     |    non     |  non   |
| Voir l'onglet Cotisations |  oui  |   oui     |    non     |  non   |
| Gérer les utilisateurs    |  oui  |   non     |    non     |  non   |
| Exporter la base          |  oui  |   non     |    non     |  non   |

\* Le membre voit le répertoire sans les coordonnées sensibles (téléphone,
e-mail, adresse, date de naissance).

## Sécurité — limites importantes

- Le fichier `.sqlite` contient **toutes** les données. Un dépôt privé GitHub
  Pro limite la lecture aux administrateurs du dépôt, mais toute personne qui
  clone le dépôt voit tout. N'ajoutez aux administrateurs du dépôt que des
  personnes de confiance.
- L'authentification côté client **n'est pas** une protection contre un
  attaquant qui aurait accès au fichier `.sqlite` : il pourrait lire les
  *hashes* et tenter de les casser. PBKDF2 (100 000 itérations) ralentit cette
  attaque mais ne l'empêche pas. Pour des données très sensibles, envisagez un
  hébergement avec backend (Supabase/Vercel) — l'option a été écartée ici pour
  la simplicité.
- Le portail est en `noindex` (hors moteurs de recherche) via la balise meta et
  `robots.txt`.

## `.gitignore` recommandé (à la racine du dépôt)

```
.DS_Store
Thumbs.db
*.log
node_modules/
```
