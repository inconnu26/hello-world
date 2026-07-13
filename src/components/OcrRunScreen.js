import { useCallback, useEffect, useRef, useState } from 'react';
import './OcrRunScreen.css';
import { ocrPage } from '../lib/ocrEngine';
import { labelForStatus } from '../lib/ocrStatus';
import { ENGINES, OPENROUTER_OCR_MODELS, LOCAL_LANGS, describeRun } from '../lib/models';
import { newRun, addRun, updateRun, updateRunPage, runToText } from '../lib/sessionModel';
import { saveText } from '../lib/pdf';

export default function OcrRunScreen({ session, settings, saveSession, runId, goSession }) {
  const [work, setWork] = useState(session);
  const workRef = useRef(work);
  const [activeRunId, setActiveRunId] = useState(runId === 'new' ? null : runId);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const cancelRef = useRef(false);

  // Config (mode "new")
  const [engine, setEngine] = useState('tesseract-local');
  const [model, setModel] = useState(OPENROUTER_OCR_MODELS[0].id);
  const [customModel, setCustomModel] = useState('');
  const [lang, setLang] = useState(settings.lang || 'fra');

  const setBoth = (next) => { workRef.current = next; setWork(next); };
  const apply = useCallback((fn) => { const next = fn(workRef.current); setBoth(next); saveSession(next); }, [saveSession]);
  const localUpdate = (fn) => setBoth(fn(workRef.current));
  const pushLog = (msg, type = 'info') => setLog((l) => [...l.slice(-250), { msg, type }]);

  const activeRun = work.runs.find((r) => r.id === activeRunId);

  const startRun = async (run) => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);
    setActiveRunId(run.id);
    const engineDef = ENGINES.find((e) => e.id === run.engine);
    pushLog(`Démarrage — ${describeRun(run)} — ${run.pages.length} page(s).`, 'head');
    apply((s) => updateRun(s, run.id, { status: 'running' }));

    for (let i = 0; i < run.pages.length; i++) {
      if (cancelRef.current) { pushLog('Interrompu.', 'head'); break; }
      const page = work.pages[i];
      apply((s) => updateRunPage(s, run.id, i, { status: 'running', progress: 0, error: null }));
      pushLog(`Page ${i + 1} : ${engineDef.kind === 'cloud' ? 'envoi au modèle…' : 'traitement local…'}`);
      let last = '';
      try {
        const res = await ocrPage(
          { engine: run.engine, model: run.model, lang: run.lang, apiKey: settings.openrouterKey, threshold: settings.threshold },
          page,
          (m) => {
            const label = labelForStatus(m.status) || m.status;
            localUpdate((s) => updateRunPage(s, run.id, i, { progress: m.progress || 0, statusText: label }));
            if (m.status && m.status !== last) { last = m.status; pushLog(`Page ${i + 1} : ${label} (${Math.round((m.progress || 0) * 100)}%)`); }
          }
        );
        apply((s) => updateRunPage(s, run.id, i, { status: 'done', progress: 1, text: res.text, confidence: res.confidence != null ? res.confidence : null, statusText: 'Terminé' }));
        pushLog(`Page ${i + 1} : ✓ ${res.text.length} caractères${res.confidence != null ? `, confiance ${Math.round(res.confidence)}%` : ''}.`, 'ok');
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        apply((s) => updateRunPage(s, run.id, i, { status: 'error', error: msg, statusText: 'Erreur' }));
        pushLog(`Page ${i + 1} : ✗ ${msg}`, 'err');
      }
    }
    apply((s) => {
      const r = s.runs.find((x) => x.id === run.id);
      const allDone = r.pages.every((p) => p.status === 'done' || p.status === 'error');
      return updateRun(s, run.id, { status: allDone ? 'done' : 'running' });
    });
    pushLog('Analyse terminée.', 'head');
    setRunning(false);
  };

  const createAndStart = () => {
    const chosenModel = engine === 'openrouter' ? (customModel.trim() || model) : null;
    const run = newRun(work, { engine, model: chosenModel, lang: engine === 'tesseract-local' ? lang : null });
    apply((s) => addRun(s, run));
    startRun(run);
  };

  // relance des pages manquantes d'un run existant
  const resume = () => { if (activeRun) startRun(activeRun); };

  useEffect(() => () => { cancelRef.current = true; }, []);

  const cloudNoKey = engine === 'openrouter' && !settings.openrouterKey;

  return (
    <div className="screen ocrrun">
      <header className="or-header">
        <button className="ghost-btn" onClick={goSession}>‹ {session.name}</button>
        <h1>Analyse OCR</h1>
        <span />
      </header>

      {/* CONFIG (nouveau run) */}
      {!activeRun && (
        <section className="card">
          <h2>Moteur OCR</h2>
          {ENGINES.map((e) => (
            <label key={e.id} className={`engine-opt ${engine === e.id ? 'sel' : ''}`}>
              <input type="radio" name="engine" checked={engine === e.id} onChange={() => setEngine(e.id)} />
              <div>
                <div className="eng-label">{e.label}</div>
                <div className="eng-desc">{e.description}</div>
              </div>
            </label>
          ))}

          {engine === 'tesseract-local' && (
            <label className="row"><span>Langue</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                {LOCAL_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
          )}

          {engine === 'openrouter' && (
            <>
              <label className="row column"><span>Modèle</span>
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  {OPENROUTER_OCR_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
                </select>
              </label>
              <label className="row column"><span>…ou slug OpenRouter personnalisé</span>
                <input placeholder="ex: google/gemini-2.5-pro" value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
              </label>
              {cloudNoKey && <div className="key-warn">⚠️ Ajoute ta clé OpenRouter dans les réglages pour utiliser un moteur cloud.</div>}
            </>
          )}

          <button className="primary big" onClick={createAndStart} disabled={cloudNoKey || work.pages.length === 0}>
            ▶ Lancer l'OCR sur {work.pages.length} page{work.pages.length > 1 ? 's' : ''}
          </button>
        </section>
      )}

      {/* RUN ACTIF */}
      {activeRun && (
        <>
          <section className="overall">
            <div className="overall-top">
              <span>{describeRun(activeRun)}</span>
              <span>{activeRun.pages.filter((p) => p.status === 'done').length}/{activeRun.pages.length}</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{ width: `${(activeRun.pages.filter((p) => p.status === 'done').length / Math.max(1, activeRun.pages.length)) * 100}%` }} /></div>
            <div className="run-buttons">
              {!running && activeRun.pages.some((p) => p.status !== 'done') && (
                <button className="primary" onClick={resume}>{activeRun.status === 'pending' ? '▶ Lancer' : '↻ Reprendre les pages restantes'}</button>
              )}
              {running && <button className="secondary" onClick={() => { cancelRef.current = true; }}>■ Arrêter</button>}
              <button className="secondary small" onClick={() => saveText(runToText(work, activeRun), `${session.name}-ocr.txt`)}>⬇︎ .txt</button>
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
            <h2>Pages</h2>
            {activeRun.pages.map((pg, i) => (
              <div key={i} className={`page-row ${pg.status}`}>
                <img className="row-thumb" src={work.pages[i] ? work.pages[i].originalDataUrl : ''} alt={`Page ${i + 1}`} />
                <div className="row-info">
                  <div className="row-head"><b>Page {i + 1}</b>
                    <span className={`chip ${pg.status}`}>{pg.status === 'done' ? 'Terminé' : pg.status === 'running' ? 'En cours' : pg.status === 'error' ? 'Erreur' : 'En attente'}</span>
                  </div>
                  {pg.status === 'running' && <div className="row-status">{pg.statusText} — {Math.round((pg.progress || 0) * 100)}%</div>}
                  {pg.status === 'error' && <div className="row-error">{pg.error}</div>}
                  {pg.status === 'done' && <div className="row-text">{(pg.text || '').slice(0, 140)}{(pg.text || '').length > 140 ? '…' : ''}</div>}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
