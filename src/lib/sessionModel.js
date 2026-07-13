// Modèle de données pur (sans effets de bord) pour les sessions/livres.
// Une session = un livre : des photos, plusieurs analyses OCR, des homogénéisations.
// Toutes les fonctions sont immuables et testables sans navigateur.

let counter = 0;
export function uid(prefix, now) {
  counter += 1;
  const t = now == null ? Date.now() : now;
  return `${prefix}_${t}_${counter}`;
}

export function newSession({ name, now } = {}) {
  const t = now == null ? Date.now() : now;
  return {
    id: uid('s', t),
    name: name || 'Nouveau livre',
    createdAt: t,
    updatedAt: t,
    captureMode: 'single', // 'single' (1 page) | 'double' (livre ouvert = 2 pages)
    pages: [], // { id, originalDataUrl, width, height }
    runs: [], // analyses OCR
    homogenizations: [], // { id, sourceRunId, model, createdAt, status, pages:[{text}], error }
  };
}

export function renameSession(session, name, now) {
  return { ...session, name: name || session.name, updatedAt: now == null ? Date.now() : now };
}

export function newPage(page, now) {
  const { id, ...rest } = page || {};
  return { id: id || uid('p', now), ...rest };
}

export function addPages(session, pages, now) {
  const added = pages.map((p) => newPage(p, now));
  return { ...session, pages: [...session.pages, ...added], updatedAt: now == null ? Date.now() : now };
}

// Remplace l'image d'une page existante (même id, même position). Les analyses
// OCR (indexées par position) restent valides ; leur texte devient obsolète et
// pourra être relancé sur la nouvelle photo.
export function replacePage(session, pageId, patch, now) {
  return {
    ...session,
    pages: session.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
    updatedAt: now == null ? Date.now() : now,
  };
}

export function removePage(session, pageId, now) {
  return {
    ...session,
    pages: session.pages.filter((p) => p.id !== pageId),
    updatedAt: now == null ? Date.now() : now,
  };
}

export function movePage(session, pageId, dir, now) {
  const i = session.pages.findIndex((p) => p.id === pageId);
  if (i < 0) return session;
  const j = i + dir;
  if (j < 0 || j >= session.pages.length) return session;
  const pages = [...session.pages];
  [pages[i], pages[j]] = [pages[j], pages[i]];
  return { ...session, pages, updatedAt: now == null ? Date.now() : now };
}

// Crée une analyse OCR (un run) avec un statut initial par page.
export function newRun(session, { engine, model, lang }, now) {
  const t = now == null ? Date.now() : now;
  return {
    id: uid('run', t),
    engine, // 'tesseract-local' | 'openrouter'
    model: model || null, // slug OpenRouter éventuel
    lang: lang || null,
    createdAt: t,
    status: 'pending', // pending | running | done | error
    pages: session.pages.map((p) => ({
      pageId: p.id,
      status: 'pending',
      progress: 0,
      text: '',
      confidence: null,
      error: null,
    })),
  };
}

function replaceById(list, id, patch) {
  return list.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

export function addRun(session, run, now) {
  return { ...session, runs: [...session.runs, run], updatedAt: now == null ? Date.now() : now };
}

export function updateRun(session, runId, patch, now) {
  return { ...session, runs: replaceById(session.runs, runId, patch), updatedAt: now == null ? Date.now() : now };
}

// Met à jour une page à l'intérieur d'un run.
export function updateRunPage(session, runId, pageIndex, patch, now) {
  const runs = session.runs.map((run) => {
    if (run.id !== runId) return run;
    const pages = run.pages.map((pg, i) => (i === pageIndex ? { ...pg, ...patch } : pg));
    return { ...run, pages };
  });
  return { ...session, runs, updatedAt: now == null ? Date.now() : now };
}

export function removeRun(session, runId, now) {
  return {
    ...session,
    runs: session.runs.filter((r) => r.id !== runId),
    homogenizations: session.homogenizations.filter((h) => h.sourceRunId !== runId),
    updatedAt: now == null ? Date.now() : now,
  };
}

export function runProgress(run) {
  if (!run || run.pages.length === 0) return 0;
  const done = run.pages.filter((p) => p.status === 'done').length;
  return done / run.pages.length;
}

export function runToText(session, run) {
  // Concatène le texte de toutes les pages du run, dans l'ordre des photos.
  return run.pages.map((p, i) => `--- Page ${i + 1} ---\n${p.text || ''}`).join('\n\n');
}

// Homogénéisations
export function newHomogenization({ sourceRunId, model }, pageCount, now) {
  const t = now == null ? Date.now() : now;
  return {
    id: uid('hom', t),
    sourceRunId,
    model,
    createdAt: t,
    status: 'pending',
    pages: Array.from({ length: pageCount }, () => ({ status: 'pending', text: '', error: null })),
  };
}

export function addHomogenization(session, hom, now) {
  return {
    ...session,
    homogenizations: [...session.homogenizations, hom],
    updatedAt: now == null ? Date.now() : now,
  };
}

export function removeHomogenization(session, homId, now) {
  return {
    ...session,
    homogenizations: session.homogenizations.filter((h) => h.id !== homId),
    updatedAt: now == null ? Date.now() : now,
  };
}

export function updateHomogenization(session, homId, patch, now) {
  return {
    ...session,
    homogenizations: replaceById(session.homogenizations, homId, patch),
    updatedAt: now == null ? Date.now() : now,
  };
}

export function updateHomogenizationPage(session, homId, pageIndex, patch, now) {
  const homogenizations = session.homogenizations.map((h) => {
    if (h.id !== homId) return h;
    const pages = h.pages.map((pg, i) => (i === pageIndex ? { ...pg, ...patch } : pg));
    return { ...h, pages };
  });
  return { ...session, homogenizations, updatedAt: now == null ? Date.now() : now };
}
