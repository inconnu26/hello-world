import { useMemo, useRef, useState } from 'react';
import './OcrScreen.css';
import { toHighContrast } from '../lib/imageProcessing';
import { recognizePage, labelForStatus, terminate } from '../lib/ocr';
import { buildTextPdf, buildImagePdf, savePdf } from '../lib/pdf';

export default function OcrScreen({ pages, settings, updatePage, goGallery }) {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const runningRef = useRef(false);
  const logEndRef = useRef(null);

  const pushLog = (msg, type = 'info') => {
    setLog((l) => [...l.slice(-200), { msg, type, t: log.length }]);
    // fait défiler vers le bas
    requestAnimationFrame(() => {
      if (logEndRef.current) logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    });
  };

  const stats = useMemo(() => {
    const done = pages.filter((p) => p.ocr.status === 'done').length;
    const err = pages.filter((p) => p.ocr.status === 'error').length;
    return { done, err, total: pages.length };
  }, [pages]);

  const overall = pages.length ? stats.done / pages.length : 0;

  async function runOcr(onlyPending) {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    pushLog(`Démarrage de l'OCR — langue « ${settings.lang} », ${pages.length} page(s).`, 'head');

    const targets = pages.filter((p) =>
      onlyPending ? p.ocr.status !== 'done' : true
    );

    for (let k = 0; k < targets.length; k++) {
      const page = targets[k];
      const pageNo = pages.findIndex((p) => p.id === page.id) + 1;
      let lastStatus = '';

      try {
        updatePage(page.id, { ocr: { status: 'running', progress: 0, statusText: 'Préparation…', error: null } });
        pushLog(`Page ${pageNo} : préparation de l'image (noir & blanc, contraste)…`);

        // 1) Post-traitement N&B
        const proc = await toHighContrast(page.originalDataUrl, { threshold: settings.threshold });
        updatePage(page.id, { processedDataUrl: proc.dataUrl });

        // 2) OCR (progression relayée par le logger Tesseract)
        pushLog(`Page ${pageNo} : lancement du moteur OCR…`);
        const data = await recognizePage(proc.dataUrl, settings.lang, (m) => {
          const label = labelForStatus(m.status);
          updatePage(page.id, {
            ocr: { status: 'running', progress: m.progress || 0, statusText: label },
          });
          if (m.status && m.status !== lastStatus) {
            lastStatus = m.status;
            pushLog(`Page ${pageNo} : ${label} (${Math.round((m.progress || 0) * 100)}%)`);
          }
        });

        const text = (data.text || '').trim();
        const conf = data.confidence;
        updatePage(page.id, {
          ocr: { status: 'done', progress: 1, statusText: 'Terminé', text, confidence: conf, error: null },
        });
        pushLog(
          `Page ${pageNo} : ✓ terminé — ${text.length} caractères, confiance ${Math.round(conf)}%.`,
          'ok'
        );
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        updatePage(page.id, { ocr: { status: 'error', statusText: 'Erreur', error: msg } });
        pushLog(`Page ${pageNo} : ✗ ERREUR — ${msg}`, 'err');
      }
    }

    pushLog('OCR terminé.', 'head');
    runningRef.current = false;
    setRunning(false);
  }

  const allDone = stats.done === pages.length && pages.length > 0;

  const exportTextPdf = () => {
    const ordered = pages.map((p) => ({ text: p.ocr.text }));
    const doc = buildTextPdf(ordered, { title: 'Livre scanné' });
    savePdf(doc, 'livre-ocr-texte.pdf');
  };

  const exportImagePdf = () => {
    const imgs = pages
      .filter((p) => p.processedDataUrl)
      .map((p) => ({ dataUrl: p.processedDataUrl, width: p.width, height: p.height }));
    if (imgs.length === 0) {
      window.alert("Lance d'abord l'OCR pour générer les images traitées.");
      return;
    }
    const doc = buildImagePdf(imgs);
    savePdf(doc, 'livre-scans-nb.pdf');
  };

  const resetEngine = async () => {
    await terminate();
    pushLog('Moteur OCR réinitialisé.', 'head');
  };

  if (pages.length === 0) {
    return (
      <div className="screen ocr">
        <header className="o-header">
          <button className="ghost-btn" onClick={goGallery}>‹ Photos</button>
          <h1>OCR</h1>
          <span />
        </header>
        <div className="empty-state">
          <p>Aucune photo à analyser.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen ocr">
      <header className="o-header">
        <button className="ghost-btn" onClick={goGallery}>‹ Photos</button>
        <h1>Reconnaissance de texte</h1>
        <span />
      </header>

      {/* Progression globale */}
      <section className="overall">
        <div className="overall-top">
          <span>
            {stats.done}/{stats.total} pages
            {stats.err > 0 && <span className="err-count"> · {stats.err} erreur(s)</span>}
          </span>
          <span>{Math.round(overall * 100)}%</span>
        </div>
        <div className="bar"><div className="bar-fill" style={{ width: `${overall * 100}%` }} /></div>
        <div className="run-buttons">
          <button className="primary" onClick={() => runOcr(true)} disabled={running}>
            {running ? '⏳ Analyse en cours…' : allDone ? 'Relancer les pages restantes' : "▶ Lancer l'OCR"}
          </button>
          {!running && (
            <button className="secondary small" onClick={() => runOcr(false)}>Tout relancer</button>
          )}
        </div>
      </section>

      {/* Journal détaillé des calculs */}
      <section className="log-section">
        <h2>Journal détaillé</h2>
        <div className="log" ref={logEndRef}>
          {log.length === 0 && <div className="log-line info">En attente du lancement…</div>}
          {log.map((l, i) => (
            <div key={i} className={`log-line ${l.type}`}>{l.msg}</div>
          ))}
        </div>
        {!running && <button className="link-btn" onClick={resetEngine}>Réinitialiser le moteur OCR</button>}
      </section>

      {/* Détail par page */}
      <section className="pages-detail">
        <h2>Pages</h2>
        {pages.map((p, i) => (
          <div key={p.id} className={`page-row ${p.ocr.status}`}>
            <img className="row-thumb" src={p.originalDataUrl} alt={`Page ${i + 1}`} />
            <div className="row-info">
              <div className="row-head">
                <b>Page {i + 1}</b>
                <StatusChip ocr={p.ocr} />
              </div>
              {p.ocr.status === 'running' && (
                <>
                  <div className="mini-bar"><div className="mini-fill" style={{ width: `${p.ocr.progress * 100}%` }} /></div>
                  <div className="row-status">{p.ocr.statusText} — {Math.round(p.ocr.progress * 100)}%</div>
                </>
              )}
              {p.ocr.status === 'error' && <div className="row-error">{p.ocr.error}</div>}
              {p.ocr.status === 'done' && (
                <button className="link-btn" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  {expanded === p.id ? 'Masquer le texte' : 'Voir / corriger le texte'}
                </button>
              )}
              {expanded === p.id && (
                <textarea
                  className="text-edit"
                  value={p.ocr.text}
                  onChange={(e) => updatePage(p.id, { ocr: { text: e.target.value } })}
                  rows={8}
                />
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Export */}
      <section className="export">
        <h2>Export PDF</h2>
        <p className="hint">
          Le PDF « texte » contient le texte reconnu (sélectionnable), une page PDF par photo,
          dans l'ordre. Le PDF « scans » contient les images noir &amp; blanc.
        </p>
        <div className="export-btns">
          <button className="primary" onClick={exportTextPdf} disabled={stats.done === 0}>
            📄 PDF texte (OCR)
          </button>
          <button className="secondary" onClick={exportImagePdf} disabled={stats.done === 0}>
            🖼️ PDF des scans N&B
          </button>
        </div>
      </section>
    </div>
  );
}

function StatusChip({ ocr }) {
  const map = {
    pending: ['En attente', 'chip pending'],
    running: ['En cours', 'chip running'],
    done: ['Terminé', 'chip done'],
    error: ['Erreur', 'chip error'],
  };
  const [label, cls] = map[ocr.status] || map.pending;
  return <span className={cls}>{label}</span>;
}
