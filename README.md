# Panel TICE : Collège Anne Frank (Lambersart)

Panel de gestion du parc informatique pour le poste d'AED TICE.

- **`/`** : page publique où les enseignants signalent une panne, sans compte. Ils reçoivent un **code de suivi** pour voir l'avancement et ta réponse.
- **`/admin`** : panel réservé au référent TICE :
  - tableau de bord ;
  - inventaire du parc (avec import CSV) ;
  - journal de bord ;
  - signalements ;
  - chantiers (kanban avec des étapes).

Site 100 % statique (HTML/JS, pas de build) hébergé sur **Vercel**, données dans **Firebase** (Firestore + Authentication).

---

## Mise en place (une seule fois)

### 1. Projet Firebase
1. Va sur <https://console.firebase.google.com> → **Ajouter un projet** (ex. `panel-tice`). Google Analytics n'est pas utile.
2. **Build → Firestore Database → Créer une base de données**. Région `eur3 (europe-west)`, démarrage en **mode production**.
3. **Build → Authentication → Commencer**. Active le fournisseur **E-mail/Mot de passe**.
4. Dans **Authentication → Utilisateurs → Ajouter un utilisateur**, crée ton compte admin (ton e-mail + un mot de passe solide). **Copie l'UID** affiché.
5. Dans **Firestore → Données → Commencer une collection** :
   - ID de collection : `admins`
   - ID du document : *ton UID*
   - un champ quelconque, par ex. `nom` = `Lucas GEST`
6. **Paramètres du projet (⚙️) → Vos applications → `</>` (Web)** : enregistre une appli. Firebase affiche un objet `firebaseConfig`. Copie `.env.example` en **`.env`** et remplis-le avec ces valeurs.
   - `.env` et le fichier généré `js/firebase-config.js` sont dans `.gitignore` : ils ne partent jamais sur GitHub.
   - En local : `node scripts/gen-config.mjs` génère `js/firebase-config.js`, puis sers le dossier (ex. `npx serve .`).

### 2. Règles de sécurité
Copie le contenu de **`firestore.rules`** dans **Firestore → Règles**, puis **Publier**.
(Ou avec la CLI : `npm i -g firebase-tools && firebase login && firebase use --add && firebase deploy --only firestore:rules`.)

### 3. Vercel
1. <https://vercel.com/new> → importe le dépôt GitHub `LucasGest/panelTICE`.
2. Framework : **Other**. La commande de build et le dossier de sortie sont déjà définis dans `vercel.json`.
3. Avant de déployer, dans **Environment Variables**, ajoute les 6 variables de ton `.env` (`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`). Astuce : tu peux coller tout le contenu du `.env` d'un coup dans le premier champ. Puis **Deploy**.
4. Dans Firebase → **Authentication → Paramètres → Domaines autorisés**, ajoute ton domaine Vercel (ex. `panel-tice.vercel.app`).

### 4. Premier lancement
Ouvre `https://<ton-domaine>/admin`, connecte-toi. Comme la base est vide, un bouton propose de **charger les données de départ** : les chantiers en cours, les 2 postes connus et l'entrée du 12/11 (salle 211).

Donne ensuite aux enseignants le lien `https://<ton-domaine>/` (affiche-le en salle des profs, ou en QR code).

---

## Utilisation

| Besoin | Où |
|---|---|
| Importer l'inventaire (OCS, Kwartz, ancien fichier Excel enregistré en CSV) | Parc → **Importer** |
| Consigner une intervention | **+ Journal** (ou depuis la fiche d'un poste) |
| Traiter un signalement | Signalements → clic → statut + réponse. En le passant en « Résolu », il est consigné automatiquement au journal |
| Suivre un projet de fond | Chantiers |
| Sauvegarder toutes les données | Barre latérale → **Sauvegarde JSON** |
| Exporter vers Excel | Bouton **Exporter CSV** sur chaque liste |

**Format d'import :** une ligne par équipement, séparateur `;`, `,` ou tabulation. En-têtes reconnus : `nom`, `salle`, `type`, `modele`, `os`, `etat`, `serie`, `ip`, `notes`, plus les variantes courantes (hostname, localisation, numéro de série…). Un équipement est identifié par son **nom réseau** : réimporter met à jour les postes existants.

## Sécurité

- La config Firebase (`.env`) reste hors de GitHub, mais elle est forcément visible dans le navigateur : elle n'est **pas secrète**. La protection est assurée par `firestore.rules`.
- Sans compte admin, on ne peut **que** créer un signalement (champs contrôlés, statut forcé à « ouvert ») ou en lire un dont on connaît le code. Impossible de lister les signalements ou de voir le parc, le journal et les chantiers.
- Ajouter un autre admin : crée son compte dans Authentication, puis un document `admins/<son UID>`.
- Si tu reçois du spam via la page publique, active **Firebase App Check** (reCAPTCHA) sur Firestore.

## Structure

```
index.html          page publique de signalement + suivi
admin/index.html    panel TICE
js/firebase.js      initialisation Firebase
scripts/gen-config.mjs  génère js/firebase-config.js depuis .env
.env.example        modèle de configuration
js/common.js        constantes et utilitaires partagés
js/admin.js         logique du panel
js/seed.js          données de départ
css/style.css       styles (clair/sombre automatique)
firestore.rules     règles de sécurité Firestore
vercel.json         URLs propres + en-têtes de sécurité
```

Lucas GEST, AED TICE
