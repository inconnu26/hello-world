# 📖 Book Scanner OCR

Application web **mobile** pour numériser des livres : capture photo en rafale à
intervalle réglable, post-traitement noir & blanc à fort contraste, **OCR local**
(reconnaissance de texte) et **export PDF** — le tout **100 % sur l'appareil**,
sans envoyer aucune image sur internet.

> Cas d'usage : poser le téléphone au-dessus d'un livre, prendre une photo toutes
> les N secondes, puis extraire le texte de toutes les pages dans un PDF (page 1,
> page 2, …).

## ✨ Fonctionnalités

- **Aperçu vidéo en temps réel** pendant toute la capture (cadrage garanti).
- **Rafale automatique** avec intervalle réglable (2 à 10 s) via un bouton +/−.
- **Compte à rebours sonore** : bips + annonce vocale « 3, 2, 1 » (désactivables).
- **Session de photos** avec galerie : navigation par **boutons** et par **swipe
  gauche/droite**, réordonnancement, suppression, aperçu du rendu noir & blanc.
- **Post-traitement** automatique : niveaux de gris + binarisation à contraste
  réglable pour optimiser l'OCR.
- **OCR hors-ligne** via Tesseract (WebAssembly) avec **progression détaillée** :
  pourcentage réel, étape en cours, journal des calculs et messages d'erreur.
- **Export PDF** : un PDF texte sélectionnable (une page par photo, dans l'ordre)
  ou un PDF des scans noir & blanc.
- Le texte reconnu est **corrigeable** page par page avant l'export.

## 🧠 Comment marche l'OCR (et pourquoi c'est local)

Le moteur de référence pour l'OCR est **Tesseract** (celui utilisé par les
bibliothèques Python `pytesseract` / `easyocr`). Comme cette application doit être
**hébergée et fonctionner sur mobile**, elle utilise **Tesseract.js**, la version
de ce moteur compilée en **WebAssembly** qui s'exécute directement dans le
navigateur.

Conséquences :

- Aucune image n'est envoyée sur un serveur : tout le calcul se fait sur le
  téléphone.
- Le moteur (worker + WASM) et les données de langue sont **embarqués dans
  l'application** (`public/tesseract/` et `public/tessdata/`) : l'OCR fonctionne
  même **sans connexion internet**.

Langues incluses : **français, anglais, français+anglais, hébreu**.

## 📱 Utilisation

1. **Réglages** (écran d'accueil) : choisir l'intervalle (bouton +/−), les sons
   et la langue de l'OCR.
2. **Scan** : l'aperçu s'affiche en temps réel. Appuyer sur ▶ pour lancer la
   rafale (ou sur « Photo » pour une capture manuelle). Le décompte annonce
   chaque prise de vue.
3. **Mes photos** : vérifier, réordonner ou supprimer les pages, prévisualiser
   le rendu noir & blanc.
4. **OCR** : lancer la reconnaissance et suivre la progression détaillée.
5. **Export** : générer le PDF texte ou le PDF des scans.

> ⚠️ La caméra n'est accessible qu'en **HTTPS** (ou sur `localhost`). GitHub Pages
> sert le site en HTTPS, donc la caméra fonctionne une fois déployé.

## 🚀 Développement local

```bash
npm install
npm start      # http://localhost:3000
npm run build  # build de production dans build/
```

## ✅ Tests (batterie de vérification)

Une suite de tests prouve que tout fonctionne et sert de garde-fou à chaque
modification (elle tourne automatiquement en CI via `.github/workflows/ci.yml`).

```bash
npm run test:unit   # tests unitaires (Jest) : logique de session, statuts OCR, PDF
npm run test:e2e    # tests end-to-end (Playwright, vrai navigateur) — nécessite un build
npm run test:all    # unitaires + build + end-to-end
```

**Tests unitaires** (`src/lib/*.test.js`) : gestion de la session de photos
(ajout / suppression / réordonnancement / mise à jour de l'OCR), bornes de la
fréquence, chargement des réglages, traduction des étapes OCR, génération des
PDF (texte et images).

**Tests end-to-end** (`e2e/*.spec.js`), avec une caméra factice :

- `app-flow` : réglage de la fréquence, **aperçu vidéo temps réel**, capture de
  photos, **galerie** (boutons précédent/suivant, **swipe**, aperçu N&B),
  déroulement complet de l'**OCR** jusqu'à la fin, **export PDF** (téléchargement),
  et absence d'erreur console.
- `image-processing` : le post-traitement produit bien une image **binarisée**
  (noir & blanc, sans couleur résiduelle).
- `ocr-accuracy` : l'**OCR reconnaît réellement** un texte français connu
  (≥ 70 % des mots, confiance élevée) — via la vraie chaîne de l'app, hors-ligne.

> Les tests e2e exercent les vraies fonctions du bundle grâce à une petite API
> exposée uniquement quand l'URL contient `?e2e` (aucun effet en production).

## 🌐 Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et déploie automatiquement
le site à chaque push.

**Étape unique à faire une fois** dans le dépôt GitHub :
`Settings` → `Pages` → `Build and deployment` → **Source : GitHub Actions**.

Ensuite, chaque push sur `master` (ou sur la branche de développement) déclenche
le déploiement. L'URL publique sera de la forme :

```
https://<utilisateur>.github.io/<dépôt>/
```

`homepage: "."` dans `package.json` assure des chemins relatifs, donc le site
fonctionne quel que soit le sous-dossier d'hébergement.

## ➕ Ajouter une langue d'OCR

1. Télécharger `<lang>.traineddata.gz` depuis
   <https://github.com/naptha/tessdata> (dossier `4.0.0`) dans `public/tessdata/`.
2. Ajouter l'option correspondante dans le menu de `src/components/HomeScreen.js`.

## 🗂️ Structure

```
public/
  tesseract/     Moteur OCR embarqué (worker + WASM, mode LSTM)
  tessdata/      Données de langue (.traineddata.gz)
src/
  lib/           audio, traitement d'image, OCR, PDF
  hooks/         accès caméra
  components/    écrans : Accueil, Capture, Galerie, OCR
```

## Stack

React (Create React App) · Tesseract.js · jsPDF · Web APIs (getUserMedia,
Canvas, Web Audio, SpeechSynthesis).
