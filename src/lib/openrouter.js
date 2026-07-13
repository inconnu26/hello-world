// Client OpenRouter (appels directs depuis le navigateur).
// ⚠️ La clé est stockée localement et envoyée à OpenRouter ; les images
// transmises quittent l'appareil. À n'utiliser qu'avec sa propre clé.

const BASE = 'https://openrouter.ai/api/v1';

// Beaucoup de modèles récents (GPT-5, Gemini 2.5…) sont des modèles à
// « raisonnement » : sans bornage ils génèrent des milliers de tokens de
// réflexion, ce qui rend les requêtes très lentes (et les fait échouer sur
// mobile). On réduit le raisonnement au minimum : on veut juste le texte.
const NO_THINKING = { effort: 'minimal' };

function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://book-scanner',
    'X-Title': 'Book Scanner OCR',
  };
}

// Transforme une erreur réseau opaque ("Failed to fetch") en message actionnable.
function explainNetworkError(e) {
  const msg = e && e.message ? e.message : String(e);
  if (e && e.name === 'AbortError') {
    return 'Délai dépassé : le modèle a mis trop de temps à répondre (réessaie ou change de modèle).';
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return (
      'Requête bloquée par le navigateur ou le réseau (Failed to fetch). ' +
      'Ce n\'est pas le modèle. Causes fréquentes : navigateur intégré (WeChat, Instagram, Messenger), ' +
      'bloqueur de pub / DNS privé / VPN qui bloque openrouter.ai, ou coupure réseau. ' +
      'Solution : ouvre le site directement dans Chrome ou Safari, sans bloqueur.'
    );
  }
  return msg;
}

// Requête générique avec timeout et gestion d'erreur claire.
async function request(path, { apiKey, method = 'GET', body, timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: headers(apiKey),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(explainNetworkError(e));
  }
  clearTimeout(timer);

  if (!res.ok) {
    let msg = `Erreur HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err && err.error && err.error.message) msg = `${err.error.message} (HTTP ${res.status})`;
    } catch (e) {
      /* corps non JSON */
    }
    throw new Error(msg);
  }
  return res.json();
}

// Vérifie qu'une clé est valide. Renvoie { valid, label?, error? }.
export async function validateKey(apiKey) {
  if (!apiKey || !apiKey.trim()) return { valid: false, error: 'Clé vide' };
  try {
    const data = await request('/key', { apiKey, timeoutMs: 20000 });
    const d = data.data || data;
    return { valid: true, label: d.label || 'Clé valide', limit: d.limit, usage: d.usage };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// Ping réel du endpoint de génération (petit appel) pour tester la connexion.
// Renvoie { ok, reply?, error? }.
export async function testConnection(apiKey, model = 'openai/gpt-5-nano') {
  try {
    const data = await request('/chat/completions', {
      apiKey,
      method: 'POST',
      timeoutMs: 30000,
      body: { model, messages: [{ role: 'user', content: 'Réponds seulement: OK' }], reasoning: NO_THINKING, max_tokens: 50 },
    });
    const reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    return { ok: true, reply: (reply || '').trim() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const OCR_PROMPT =
  "Tu es un moteur OCR. Transcris fidèlement TOUT le texte visible sur cette page de livre, " +
  "en respectant l'ordre de lecture, les paragraphes et les sauts de ligne. " +
  "Corrige uniquement les évidences de reconnaissance (accents, ponctuation). " +
  "Ne résume pas, n'ajoute aucun commentaire, ne mets pas de balises Markdown. " +
  "Réponds uniquement par le texte de la page.";

// OCR d'une image via un modèle vision OpenRouter. Renvoie { text }.
export async function transcribeImage({ apiKey, model, dataUrl }) {
  const data = await request('/chat/completions', {
    apiKey,
    method: 'POST',
    timeoutMs: 120000,
    body: {
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
      reasoning: NO_THINKING,
      max_tokens: 8000,
    },
  });
  const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
  return { text: (text || '').trim() };
}

const HOMOGENIZE_SYSTEM =
  "Tu es un correcteur éditorial. On te donne le texte OCR brut d'une page de livre. " +
  "Corrige les fautes de reconnaissance et de frappe, restaure l'orthographe, les accents " +
  "et la ponctuation, recompose les paragraphes proprement. Reste STRICTEMENT fidèle au " +
  "contenu : ne résume pas, ne reformule pas le style, n'ajoute ni ne supprime d'information. " +
  "Si un mot est illisible, garde-le tel quel. Réponds uniquement par le texte corrigé, sans commentaire ni balise.";

// Nettoie / met en forme un texte OCR via un LLM. Renvoie { text }.
export async function homogenizeText({ apiKey, model, rawText }) {
  const data = await request('/chat/completions', {
    apiKey,
    method: 'POST',
    timeoutMs: 120000,
    body: {
      model,
      messages: [
        { role: 'system', content: HOMOGENIZE_SYSTEM },
        { role: 'user', content: rawText || '' },
      ],
      reasoning: NO_THINKING,
      max_tokens: 8000,
    },
  });
  const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
  return { text: (text || '').trim() };
}
