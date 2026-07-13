// Registre des moteurs OCR et des modèles d'homogénéisation.
// - Moteur local : Tesseract (gratuit, hors-ligne).
// - Moteurs cloud : modèles vision via OpenRouter (nécessitent une clé).

// Modèles OpenRouter recommandés pour l'OCR de livres imprimés (cf. enquête
// OmniDocBench / OCRBench 2026). L'utilisateur peut aussi saisir un slug libre.
// Modèles OCR (vision) triés du moins cher au plus cher. Prix ≈ $/M tokens
// (entrée / sortie). Tous acceptent les images (vérifié via l'API OpenRouter).
export const OPENROUTER_OCR_MODELS = [
  { id: 'openai/gpt-5-nano', label: 'GPT-5 Nano', note: 'Le moins cher · ~$0,05/$0,40' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', note: 'Très bon marché · ~$0,10/$0,40' },
  { id: 'qwen/qwen3-vl-32b-instruct', label: 'Qwen3-VL 32B', note: 'Multilingue, économique · ~$0,10/$0,42' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', note: 'Qualité supérieure' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', note: 'Haut de gamme, mise en forme' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5', note: 'Haut de gamme, très fiable' },
];

// Modèles pour l'homogénéisation (texte -> texte propre), triés par prix.
export const OPENROUTER_TEXT_MODELS = [
  { id: 'openai/gpt-5-nano', label: 'GPT-5 Nano', note: 'Le moins cher · ~$0,05/$0,40' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', note: 'Très bon marché · ~$0,10/$0,40' },
  { id: 'qwen/qwen3-vl-32b-instruct', label: 'Qwen3-VL 32B', note: 'Multilingue, économique · ~$0,10/$0,42' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', note: 'Excellent (plus cher)' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5', note: 'Très bon (plus cher)' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', note: 'Qualité supérieure (plus cher)' },
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
