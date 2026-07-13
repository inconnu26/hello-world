import { useCallback, useEffect, useRef, useState } from 'react';
import './OcrRunScreen.css';
import { homogenizeText } from '../lib/openrouter';
import { OPENROUTER_TEXT_MODELS, describeRun } from '../lib/models';
import {
  newHomogenization,
  addHomogenization,
  updateHomogenization,
  updateHomogenizationPage,
} from '../lib/sessionModel';
import { buildBookPdf, buildDebugPdf, savePdf, saveText } from '../lib/pdf';
import { toHighContrast } from '../lib/imageProcessing';

export default function HomogenizeScreen({ session, settings, saveSession, homId, goSession }) {
  const [work, setWork] = useState(session);
  const workRef = useRef(work);
  const [activeId, setActiveId] = useState(homId === 'new' ? null : homId);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const cancelRef = useRef(false);

  const doneRuns = work.runs.filter((r) => r.pages.some((p) => p.status === 'done'));
  const [sourceRunId, setSourceRunId] = useState(doneRuns[0] ? doneRuns[0].id : '');
  const [model, setModel] = useState(OPENROUTER_TEXT_MODELS[0].id);
  const [customModel, setCustomModel] = useState('');

  const setBoth = (n) => { workRef.current = n; setWork(n); };
  const apply = useCallback((fn) => { const n = fn(workRef.current); setBoth(n); saveSession(n); }, [saveSession]);
  const pushLog = (msg, type = 'info') => setLog((l) => [...l.slice(-250), { msg, type }]);

  const activeHom = work.homogenizations.find((h) => h.id === activeId);
  const noKey = !settings.openrouterKey;

  const process = async (hom) => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setActiveId(hom.id);
    const src = work.runs.find((r) => r.id === hom.sourceRunId);
    pushLog(`Homogénéisation via ${hom.model}, source : ${describeRun(src)}.`, 'head');
    apply((s) => updateHomogenization(s, hom.id, { status: 'running' }));

    for (let i = 0; i < hom.pages.length; i++) {
      if (cancelRef.current) { pushLog('Interrompu.', 'head'); break; }
      // Ne retraite pas les pages déjà terminées (reprise optimisée).
      const curHom = workRef.current.homogenizations.find((h) => h.id === hom.id);
      if (curHom && curHom.pages[i] && curHom.pages[i].status === 'done') {
        pushLog(`Page ${i + 1} : déjà faite, ignorée.`);
        continue;
      }
      const raw = (src.pages[i] && src.pages[i].text) || '';
      apply((s) => updateHomogenizationPage(s, hom.id, i, { status: 'running', error: null }));
      if (!raw.trim()) {
        apply((s) => updateHomogenizationPage(s, hom.id, i, { status: 'done', text: '' }));
        pushLog(`Page ${i + 1} : vide, ignorée.`);
        continue;
      }
      try {
        pushLog(`Page ${i + 1} : correction…`);
        const { text } = await homogenizeText({ apiKey: settings.openrouterKey, model: hom.model, rawText: raw });
        apply((s) => updateHomogenizationPage(s, hom.id, i, { status: 'done', text }));
        pushLog(`Page ${i + 1} : ✓ ${text.length} caractères.`, 'ok');
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        apply((s) => updateHomogenizationPage(s, hom.id, i, { status: 'error', error: msg }));
        pushLog(`Page ${i + 1} : ✗ ${msg}`, 'err');
      }
    }
    apply((s) => updateHomogenization(s, hom.id, { status: 'done' }));
    pushLog('Terminé. Tu peux exporter le PDF.', 'head');
    setRunning(false);
  };

  const createAndRun = () => {
    const src = work.runs.find((r) => r.id === sourceRunId);
    if (!src) return;
    const chosen = customModel.trim() || model;
    const hom = newHomogenization({ sourceRunId, model: chosen }, src.pages.length);
    apply((s) => addHomogenization(s, hom));
    process(hom);
  };

  const exportPdf = (pages) => {
    const doc = buildBookPdf(pages, { title: session.name });
    savePdf(doc, `${session.name}.pdf`);
  };

  // TXT : texte intégral continu (sans découpage ni numéros de page).
  const exportTxt = (pages) => {
    const text = pages.map((p) => (p.text || '').trim()).filter(Boolean).join('\n\n');
    saveText(text, `${session.name}.txt`);
  };

  // PDF de debug : l'image RÉELLEMENT envoyée à l'OCR (N&B si run local,
  // couleur si run cloud) + la transcription, page par page.
  const [dbgBusy, setDbgBusy] = useState(false);
  const exportDebug = async (hom) => {
    setDbgBusy(true);
    try {
      const src = work.runs.find((r) => r.id === hom.sourceRunId);
      const isLocal = src && src.engine === 'tesseract-local';
      const items = [];
      for (let i = 0; i < hom.pages.length; i++) {
        const pg = work.pages[i];
        let dataUrl = pg ? pg.originalDataUrl : null;
        let width = pg ? pg.width : 0;
        let height = pg ? pg.height : 0;
        if (isLocal && dataUrl) {
          try {
            const proc = await toHighContrast(dataUrl, { threshold: settings.threshold });
            dataUrl = proc.dataUrl;
            width = proc.width;
            height = proc.height;
          } catch (e) {
            /* garde la couleur si le traitement échoue */
          }
        }
        items.push({ dataUrl, width, height, text: hom.pages[i].text });
      }
      const doc = buildDebugPdf(items, {
        title: session.name,
        imageLabel: isLocal ? "Photo N&B envoyée à l'OCR" : 'Photo couleur envoyée au modèle',
      });
      savePdf(doc, `${session.name}-debug.pdf`);
    } finally {
      setDbgBusy(false);
    }
  };

  // Export direct du texte OCR brut (sans IA)
  const exportRawPdf = () => {
    const src = work.runs.find((r) => r.id === sourceRunId);
    if (!src) return;
    exportPdf(src.pages.map((p) => ({ text: p.text })));
  };

  useEffect(() => () => { cancelRef.current = true; }, []);

  return (
    <div className="screen ocrrun">
      <header className="or-header">
        <button className="ghost-btn" onClick={goSession}>‹ {session.name}</button>
        <h1>Mise en forme → PDF</h1>
        <span />
      </header>

      {!activeHom && (
        <section className="card">
          <h2>Source</h2>
          <label className="row column"><span>Analyse OCR à homogénéiser</span>
            <select value={sourceRunId} onChange={(e) => setSourceRunId(e.target.value)}>
              {doneRuns.length === 0 && <option value="">Aucune analyse terminée</option>}
              {doneRuns.map((r) => <option key={r.id} value={r.id}>{describeRun(r)}</option>)}
            </select>
          </label>

          <h2>Modèle de correction (IA)</h2>
          <label className="row column"><span>Modèle</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {OPENROUTER_TEXT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
            </select>
          </label>
          <label className="row column"><span>…ou slug personnalisé</span>
            <input placeholder="ex: anthropic/claude-sonnet-4.6" value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
          </label>

          {noKey && <div className="key-warn">⚠️ L'homogénéisation IA nécessite une clé OpenRouter (réglages). Tu peux quand même générer un PDF du texte OCR brut ci-dessous.</div>}

          <button className="primary big" onClick={createAndRun} disabled={noKey || !sourceRunId}>
            ✨ Corriger &amp; mettre en forme
          </button>
          <button className="secondary" onClick={exportRawPdf} disabled={!sourceRunId}>
            📄 PDF direct du texte OCR (sans IA)
          </button>
        </section>
      )}

      {activeHom && (
        <>
          <section className="overall">
            <div className="overall-top">
              <span>{activeHom.model}</span>
              <span>{activeHom.pages.filter((p) => p.status === 'done').length}/{activeHom.pages.length}</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{ width: `${(activeHom.pages.filter((p) => p.status === 'done').length / Math.max(1, activeHom.pages.length)) * 100}%` }} /></div>
            <div className="run-buttons">
              {!running && activeHom.pages.some((p) => p.status !== 'done') && (
                <button className="primary" onClick={() => process(activeHom)}>↻ Reprendre</button>
              )}
              {running && <button className="secondary" onClick={() => { cancelRef.current = true; }}>■ Arrêter</button>}
              <button className="primary" onClick={() => exportPdf(activeHom.pages.map((p) => ({ text: p.text })))}
                disabled={!activeHom.pages.some((p) => p.status === 'done')}>
                📄 PDF
              </button>
              <button className="secondary" onClick={() => exportTxt(activeHom.pages)}
                disabled={!activeHom.pages.some((p) => p.status === 'done')}>
                ⬇︎ TXT
              </button>
              <button className="secondary" onClick={() => exportDebug(activeHom)}
                disabled={dbgBusy || !activeHom.pages.some((p) => p.status === 'done')}>
                {dbgBusy ? 'Génération…' : '🐞 PDF debug (photo + texte)'}
              </button>
            </div>
          </section>

          <section className="log-section">
            <h2>Journal</h2>
            <div className="log">
              {log.length === 0 && <div className="log-line info">En attente…</div>}
              {log.map((l, i) => <div key={i} className={`log-line ${l.type}`}>{l.msg}</div>)}
            </div>
          </section>

          <section className="pages-detail">
            <h2>Aperçu</h2>
            {activeHom.pages.map((pg, i) => (
              <div key={i} className={`page-row ${pg.status}`}>
                <div className="row-info">
                  <div className="row-head"><b>Page {i + 1}</b>
                    <span className={`chip ${pg.status}`}>{pg.status === 'done' ? 'Terminé' : pg.status === 'running' ? 'En cours' : pg.status === 'error' ? 'Erreur' : 'En attente'}</span>
                  </div>
                  {pg.status === 'error' && <div className="row-error">{pg.error}</div>}
                  {pg.status === 'done' && <div className="row-text">{(pg.text || '').slice(0, 160)}{(pg.text || '').length > 160 ? '…' : ''}</div>}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
