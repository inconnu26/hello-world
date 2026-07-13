// Client OpenRouter (appels directs depuis le navigateur).
// ⚠️ La clé est stockée localement et envoyée à OpenRouter ; les images
// transmises quittent l'appareil. À n'utiliser qu'avec sa propre clé.

const BASE = 'https://openrouter.ai/api/v1';

function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://book-scanner',
    'X-Title': 'Book Scanner OCR',
  };
}

// Vérifie qu'une clé est valide. Renvoie { valid, label?, limit?, error? }.
export async function validateKey(apiKey) {
  if (!apiKey || !apiKey.trim()) return { valid: false, error: 'Clé vide' };
  try {
    const res = await fetch(`${BASE}/key`, { headers: headers(apiKey) });
    if (res.status === 401) return { valid: false, error: 'Clé refusée (401)' };
    if (!res.ok) return { valid: false, error: `Erreur ${res.status}` };
    const data = await res.json();
    const d = data.data || data;
    return {
      valid: true,
      label: d.label || 'Clé valide',
      limit: d.limit,
      usage: d.usage,
    };
  } catch (e) {
    return { valid: false, error: 'Réseau : ' + (e && e.message ? e.message : String(e)) };
  }
}

const OCR_PROMPT =
  "Tu es un moteur OCR. Transcris fidèlement TOUT le texte visible sur cette page de livre, " +
  "en respectant l'ordre de lecture, les paragraphes et les sauts de ligne. " +
  "Corrige uniquement les évidences de reconnaissance (accents, ponctuation). " +
  "Ne résume pas, n'ajoute aucun commentaire, ne mets pas de balises Markdown. " +
  "Réponds uniquement par le texte de la page.";

// OCR d'une image via un modèle vision OpenRouter. Renvoie { text }.
export async function transcribeImage({ apiKey, model, dataUrl, signal }) {
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
  };
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const err = await res.json();
      if (err.error && err.error.message) msg = err.error.message;
    } catch (e) {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  return { text: (text || '').trim() };
}

const HOMOGENIZE_SYSTEM =
  "Tu es un correcteur éditorial. On te donne le texte OCR brut d'une page de livre. " +
  "Corrige les fautes de reconnaissance et de frappe, restaure l'orthographe, les accents " +
  "et la ponctuation, recompose les paragraphes proprement. Reste STRICTEMENT fidèle au " +
  "contenu : ne résume pas, ne reformule pas le style, n'ajoute ni ne supprime d'information. " +
  "Si un mot est illisible, garde-le tel quel. Réponds uniquement par le texte corrigé, sans commentaire ni balise.";

// Nettoie / met en forme un texte OCR via un LLM. Renvoie { text }.
export async function homogenizeText({ apiKey, model, rawText, signal }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: HOMOGENIZE_SYSTEM },
      { role: 'user', content: rawText || '' },
    ],
    temperature: 0.1,
  };
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const err = await res.json();
      if (err.error && err.error.message) msg = err.error.message;
    } catch (e) {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  return { text: (text || '').trim() };
}
