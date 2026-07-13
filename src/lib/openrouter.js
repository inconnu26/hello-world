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

// Version LOT : on envoie plusieurs pages d'un coup (meilleur contexte : chapitres,
// mots coupés recollés, cohérence). Chaque page est délimitée par un marqueur
// <<<PAGE n>>> qui DOIT être conservé tel quel dans la sortie pour re-découper.
const HOMOGENIZE_SYSTEM_BATCH =
  "Tu es un correcteur éditorial. On te donne le texte OCR brut de plusieurs pages " +
  "consécutives d'un livre. Chaque page commence par un marqueur de la forme " +
  '"<<<PAGE n>>>". \n' +
  "Ta tâche : corriger les fautes de reconnaissance/frappe, restaurer l'orthographe, " +
  "les accents, la ponctuation et les paragraphes ; recoller les mots coupés en fin de " +
  "page ; conserver la structure (titres de chapitres, sous-titres, listes) en te servant " +
  "du contexte de l'ensemble. Reste STRICTEMENT fidèle : ne résume pas, ne reformule pas " +
  "le style, n'ajoute ni ne supprime d'information. \n" +
  "IMPÉRATIF : réponds uniquement par le texte corrigé, en RECONDUISANT chaque marqueur " +
  '"<<<PAGE n>>>" exactement (mêmes numéros, même ordre, un avant chaque page). Aucun autre commentaire, aucune balise Markdown.';

// Corrige un LOT de pages en un seul appel. `pages`: [{ n, text }].
// Renvoie { text } (à re-découper via les marqueurs).
export async function homogenizeChunk({ apiKey, model, pages, timeoutMs = 180000 }) {
  const input = pages.map((p) => `<<<PAGE ${p.n}>>>\n${p.text || ''}`).join('\n\n');
  const data = await request('/chat/completions', {
    apiKey,
    method: 'POST',
    timeoutMs,
    body: {
      model,
      messages: [
        { role: 'system', content: HOMOGENIZE_SYSTEM_BATCH },
        { role: 'user', content: input },
      ],
      reasoning: NO_THINKING,
      max_tokens: 32000,
    },
  });
  const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
  return { text: text || '' };
}

// Re-découpe une réponse LOT en { numéroDePage: texte }.
export function splitByPageMarkers(text) {
  const re = /<<<\s*PAGE\s*(\d+)\s*>>>/g;
  const matches = [...text.matchAll(re)];
  const out = {};
  for (let i = 0; i < matches.length; i++) {
    const n = parseInt(matches[i][1], 10);
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    out[n] = text.slice(start, end).trim();
  }
  return out;
}
