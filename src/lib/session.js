// Logique pure de gestion d'une session de scan (liste de pages + réglages).
// Séparée des composants pour être testable unitairement.

export const DEFAULT_SETTINGS = {
  intervalSec: 4,
  sound: true,
  voice: true,
  lang: 'fra',
  threshold: 0.5,
};

export const MIN_INTERVAL = 2;
export const MAX_INTERVAL = 10;

export function clampInterval(v) {
  if (Number.isNaN(v)) return DEFAULT_SETTINGS.intervalSec;
  return Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, v));
}

let idCounter = 0;
export function nextId(now) {
  idCounter += 1;
  const t = now == null ? Date.now() : now;
  return `p${t}_${idCounter}`;
}

// Crée une page avec un état OCR initial propre.
export function newPage(page) {
  const { id, ...rest } = page || {};
  return {
    id: id || nextId(),
    ...rest,
    ocr: { status: 'pending', progress: 0, statusText: '', text: '', confidence: null, error: null },
  };
}

export function addPage(list, page) {
  return [...list, newPage(page)];
}

// Applique un patch à une page ; fusionne finement le sous-objet `ocr`.
export function updatePage(list, id, patch) {
  return list.map((p) =>
    p.id === id
      ? { ...p, ...patch, ocr: patch.ocr ? { ...p.ocr, ...patch.ocr } : p.ocr }
      : p
  );
}

export function removePage(list, id) {
  return list.filter((p) => p.id !== id);
}

// Déplace une page d'un cran (dir = -1 ou +1), en restant dans les bornes.
export function movePage(list, id, dir) {
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return list;
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

export function loadSettings(storage) {
  try {
    const raw = storage.getItem('scan.settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}
