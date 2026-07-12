// OCR local dans le navigateur via Tesseract.js (moteur Tesseract compilé en
// WebAssembly). Aucune image n'est envoyée sur internet : tout le calcul se
// fait sur l'appareil. Le worker et les données de langue sont téléchargés une
// seule fois puis mis en cache par le navigateur.

import { createWorker } from 'tesseract.js';

// Tous les fichiers Tesseract (worker, moteur WASM, langues) sont embarqués
// dans l'application : aucun accès CDN, l'OCR fonctionne 100% hors-ligne.
// On construit des URL absolues à partir de l'emplacement de l'app pour que
// ça marche aussi bien à la racine que dans un sous-dossier (GitHub Pages).
const ASSET_BASE = new URL('.', document.baseURI).href;
const WORKER_PATH = ASSET_BASE + 'tesseract/worker.min.js';
const CORE_PATH = ASSET_BASE + 'tesseract/';
const LANG_PATH = ASSET_BASE + 'tessdata';

let workerPromise = null;
let workerLang = null;

// Relais mutable : dans tesseract.js v5 le logger est fixé à la création du
// worker. On le fait pointer vers cette fonction, qu'on réaffecte avant chaque
// page pour router la progression vers la bonne image.
let relay = null;
export function setLogRelay(fn) {
  relay = fn;
}

// Traduit les étapes internes de Tesseract en libellés lisibles.
const STATUS_LABELS = {
  'loading tesseract core': 'Chargement du moteur OCR',
  'loaded tesseract core': 'Moteur OCR chargé',
  'initializing tesseract': 'Initialisation du moteur',
  'initialized tesseract': 'Moteur initialisé',
  'loading language traineddata': 'Chargement des données de langue',
  'loaded language traineddata': 'Langue chargée',
  'initializing api': "Préparation de l'analyse",
  'initialized api': 'Analyse prête',
  'recognizing text': 'Reconnaissance du texte',
};

export function labelForStatus(status) {
  if (!status) return '';
  return STATUS_LABELS[status] || status;
}

// Récupère (ou crée) un worker Tesseract pour la langue demandée.
export async function getWorker(lang) {
  if (workerPromise && workerLang === lang) return workerPromise;

  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch (e) {
      /* ignore */
    }
    workerPromise = null;
  }

  workerLang = lang;
  workerPromise = createWorker(lang, 1, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    logger: (m) => {
      if (relay) relay(m);
    },
    errorHandler: (e) => {
      if (relay) relay({ status: 'error', progress: 0, error: String(e) });
    },
  });
  return workerPromise;
}

// Lance l'OCR sur une image. onLog({ status, progress }) reçoit toute la
// progression (chargement du moteur + reconnaissance), progress: 0..1.
export async function recognizePage(imageDataUrl, lang, onLog) {
  setLogRelay(onLog);
  const worker = await getWorker(lang);
  const result = await worker.recognize(imageDataUrl);
  setLogRelay(null);
  return result.data; // { text, confidence, ... }
}

export async function terminate() {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch (e) {
      /* ignore */
    }
    workerPromise = null;
    workerLang = null;
  }
}
