import { useRef, useState } from 'react';
import './SessionScreen.css';
import { removePage, movePage, runProgress, runToText } from '../lib/sessionModel';
import { describeRun } from '../lib/models';
import { saveText } from '../lib/pdf';

export default function SessionScreen({
  session,
  saveSession,
  goHome,
  goCapture,
  goNewOcr,
  goRun,
  goHomogenize,
  goSettings,
}) {
  const [viewer, setViewer] = useState(0);
  const [showViewer, setShowViewer] = useState(false);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const touchX = useRef(null);

  const pages = session.pages;
  const idx = Math.min(viewer, Math.max(0, pages.length - 1));

  const go = (d) => setViewer((i) => Math.max(0, Math.min(pages.length - 1, i + d)));
  const onTS = (e) => (touchX.current = e.touches[0].clientX);
  const onTE = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const del = (id) => saveSession(removePage(session, id));
  const move = (id, d) => saveSession(movePage(session, id, d));

  const runA = session.runs.find((r) => r.id === compareA);
  const runB = session.runs.find((r) => r.id === compareB);

  const statusChip = (status) => {
    const map = { pending: ['En attente', 'pending'], running: ['En cours', 'running'], done: ['Terminé', 'done'], error: ['Erreur', 'error'] };
    const [l, c] = map[status] || map.pending;
    return <span className={`chip ${c}`}>{l}</span>;
  };

  return (
    <div className="screen session">
      <header className="sess-header">
        <button className="ghost-btn" onClick={goHome}>‹ Livres</button>
        <h1 title={session.name}>{session.name}</h1>
        <button className="gear" onClick={goSettings}>⚙️</button>
      </header>

      {/* PHOTOS */}
      <section className="block">
        <div className="block-head">
          <h2>Photos <span className="count">{pages.length}</span></h2>
          <button className="secondary small" onClick={goCapture}>＋ Photos</button>
        </div>
        {pages.length === 0 ? (
          <p className="hint">Aucune photo. Lance un scan pour capturer les pages du livre.</p>
        ) : (
          <div className="thumb-strip">
            {pages.map((p, i) => (
              <button key={p.id} className="thumb" onClick={() => { setViewer(i); setShowViewer(true); }}>
                <img src={p.originalDataUrl} alt={`Page ${i + 1}`} />
                <span className="thumb-num">{i + 1}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ANALYSES OCR */}
      <section className="block">
        <div className="block-head">
          <h2>Analyses OCR <span className="count">{session.runs.length}</span></h2>
          <button className="primary small" onClick={goNewOcr} disabled={pages.length === 0}>＋ Nouvel OCR</button>
        </div>
        {session.runs.length === 0 ? (
          <p className="hint">Aucune analyse. Choisis un moteur (local gratuit ou cloud) et lance l'OCR.</p>
        ) : (
          <ul className="run-list">
            {session.runs.map((run) => (
              <li key={run.id} className="run-item">
                <div className="run-main" onClick={() => goRun(run.id)}>
                  <div className="run-title">{describeRun(run)} {statusChip(run.status)}</div>
                  <div className="run-sub">
                    {run.pages.filter((p) => p.status === 'done').length}/{run.pages.length} pages ·{' '}
                    {Math.round(runProgress(run) * 100)}%
                  </div>
                </div>
                <div className="run-actions">
                  <button className="mini" title="Télécharger le texte"
                    onClick={() => saveText(runToText(session, run), `${session.name}-ocr.txt`)}>⬇︎ .txt</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Comparaison */}
        {session.runs.length >= 2 && (
          <div className="compare">
            <h3>Comparer deux OCR</h3>
            <div className="compare-selects">
              <select value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                <option value="">OCR A…</option>
                {session.runs.map((r) => <option key={r.id} value={r.id}>{describeRun(r)}</option>)}
              </select>
              <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                <option value="">OCR B…</option>
                {session.runs.map((r) => <option key={r.id} value={r.id}>{describeRun(r)}</option>)}
              </select>
            </div>
            {runA && runB && (
              <div className="compare-grid">
                {pages.map((p, i) => (
                  <div key={p.id} className="compare-row">
                    <div className="compare-page">Page {i + 1}</div>
                    <div className="compare-cols">
                      <pre>{(runA.pages[i] && runA.pages[i].text) || '—'}</pre>
                      <pre>{(runB.pages[i] && runB.pages[i].text) || '—'}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* HOMOGENEISATION */}
      <section className="block">
        <div className="block-head">
          <h2>Mise en forme (PDF) <span className="count">{session.homogenizations.length}</span></h2>
          <button className="primary small" onClick={() => goHomogenize('new')}
            disabled={!session.runs.some((r) => r.pages.some((p) => p.status === 'done'))}>
            ＋ Homogénéiser
          </button>
        </div>
        <p className="hint">
          Une IA corrige les fautes d'OCR et met en forme le texte, puis génère un beau PDF page-par-page.
        </p>
        {session.homogenizations.length > 0 && (
          <ul className="run-list">
            {session.homogenizations.map((h) => {
              const src = session.runs.find((r) => r.id === h.sourceRunId);
              return (
                <li key={h.id} className="run-item">
                  <div className="run-main" onClick={() => goHomogenize(h.id)}>
                    <div className="run-title">{h.model} {statusChip(h.status)}</div>
                    <div className="run-sub">depuis {src ? describeRun(src) : 'OCR supprimé'}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Visionneuse plein écran */}
      {showViewer && pages[idx] && (
        <div className="viewer-overlay" onClick={() => setShowViewer(false)}>
          <div className="viewer-inner" onClick={(e) => e.stopPropagation()} onTouchStart={onTS} onTouchEnd={onTE}>
            <button className="nav prev" onClick={() => go(-1)} disabled={idx === 0}>‹</button>
            <img src={pages[idx].originalDataUrl} alt={`Page ${idx + 1}`} />
            <button className="nav next" onClick={() => go(1)} disabled={idx === pages.length - 1}>›</button>
            <div className="viewer-bar">
              <span>Page {idx + 1} / {pages.length}</span>
              <div>
                <button className="mini" onClick={() => move(pages[idx].id, -1)} disabled={idx === 0}>◀</button>
                <button className="mini" onClick={() => move(pages[idx].id, 1)} disabled={idx === pages.length - 1}>▶</button>
                <button className="mini danger" onClick={() => { del(pages[idx].id); if (idx >= pages.length - 1) setViewer(Math.max(0, idx - 1)); }}>🗑</button>
                <button className="mini" onClick={() => setShowViewer(false)}>✕</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
