// Registre des moteurs OCR et des modèles d'homogénéisation.
// - Moteur local : Tesseract (gratuit, hors-ligne).
// - Moteurs cloud : modèles vision via OpenRouter (nécessitent une clé).

// Modèles OpenRouter recommandés pour l'OCR de livres imprimés (cf. enquête
// OmniDocBench / OCRBench 2026). L'utilisateur peut aussi saisir un slug libre.
export const OPENROUTER_OCR_MODELS = [
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', note: 'Le moins cher, très correct' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Meilleur rapport qualité/prix' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', note: 'Qualité supérieure' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', note: 'Excellente mise en forme' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5', note: 'Très fiable' },
  { id: 'qwen/qwen3-vl-32b-instruct', label: 'Qwen3-VL 32B', note: 'OCR multilingue, économique' },
  { id: 'qwen/qwen3-vl-8b-instruct', label: 'Qwen3-VL 8B', note: 'Le plus léger/économique' },
];

// Modèles conseillés pour l'étape d'homogénéisation (texte -> texte propre).
// Gemini 2.5 Flash Lite est de loin le moins cher et suffit largement pour corriger.
export const OPENROUTER_TEXT_MODELS = [
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', note: 'Le moins cher — recommandé pour la correction' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Un cran au-dessus' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', note: 'Excellent en correction/mise en forme' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5', note: 'Très bon en correction' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', note: 'Qualité supérieure' },
];

// Langues OCR embarquées pour le moteur local Tesseract.
export const LOCAL_LANGS = [
  { id: 'fra', label: 'Français' },
  { id: 'eng', label: 'Anglais' },
  { id: 'fra+eng', label: 'Français + Anglais' },
  { id: 'heb', label: 'Hébreu' },
];

// Un « moteur » = comment on lance l'OCR.
export const ENGINES = [
  {
    id: 'tesseract-local',
    label: 'Tesseract (local, gratuit)',
    kind: 'local',
    needsKey: false,
    description: "100 % sur l'appareil, hors-ligne. Aucune image envoyée sur internet.",
  },
  {
    id: 'openrouter',
    label: 'Modèle cloud (OpenRouter)',
    kind: 'cloud',
    needsKey: true,
    description: 'Modèles LLM/OCR haut de gamme. Les images sont envoyées à OpenRouter.',
  },
];

export function engineById(id) {
  return ENGINES.find((e) => e.id === id) || ENGINES[0];
}

// Libellé lisible pour un run OCR (moteur + modèle éventuel).
export function describeRun(run) {
  if (!run) return '';
  if (run.engine === 'tesseract-local') return `Tesseract · ${run.lang}`;
  return `OpenRouter · ${run.model}`;
}
