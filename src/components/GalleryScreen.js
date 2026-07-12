import { useEffect, useRef, useState } from 'react';
import './GalleryScreen.css';
import { toHighContrast } from '../lib/imageProcessing';

export default function GalleryScreen({
  pages,
  settings,
  removePage,
  movePage,
  clearAll,
  goHome,
  goCapture,
  goOcr,
}) {
  const [index, setIndex] = useState(0);
  const [showProcessed, setShowProcessed] = useState(false);
  const [processed, setProcessed] = useState(null);
  const [busy, setBusy] = useState(false);
  const touchStartX = useRef(null);
  const thumbStripRef = useRef(null);

  // Garde l'index dans les bornes quand la liste change.
  const clampedIndex = Math.min(index, Math.max(0, pages.length - 1));
  useEffect(() => {
    if (index !== clampedIndex) setIndex(clampedIndex);
  }, [index, clampedIndex]);

  const current = pages[clampedIndex];

  // Génère la version noir & blanc à la demande.
  useEffect(() => {
    let cancelled = false;
    if (!current || !showProcessed) {
      setProcessed(null);
      return undefined;
    }
    setBusy(true);
    toHighContrast(current.originalDataUrl, { threshold: settings.threshold })
      .then((res) => {
        if (!cancelled) setProcessed(res.dataUrl);
      })
      .catch(() => {
        if (!cancelled) setProcessed(null);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current, showProcessed, settings.threshold]);

  // Fait défiler la miniature active dans la vue.
  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!strip) return;
    const el = strip.querySelector(`[data-i="${clampedIndex}"]`);
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [clampedIndex]);

  const go = (dir) => {
    setShowProcessed(false);
    setIndex((i) => {
      const n = i + dir;
      if (n < 0) return 0;
      if (n > pages.length - 1) return pages.length - 1;
      return n;
    });
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  if (pages.length === 0) {
    return (
      <div className="screen gallery empty">
        <header className="g-header">
          <button className="ghost-btn" onClick={goHome}>‹ Accueil</button>
          <h1>Mes photos</h1>
          <span />
        </header>
        <div className="empty-state">
          <div className="empty-emoji">🖼️</div>
          <p>Aucune photo pour l'instant.</p>
          <button className="primary big" onClick={goCapture}>📷 Prendre des photos</button>
        </div>
      </div>
    );
  }

  const ocrDone = pages.filter((p) => p.ocr.status === 'done').length;
  const src = showProcessed && processed ? processed : current.originalDataUrl;

  return (
    <div className="screen gallery">
      <header className="g-header">
        <button className="ghost-btn" onClick={goHome}>‹ Accueil</button>
        <h1>Mes photos <span className="count">{pages.length}</span></h1>
        <button className="ghost-btn danger" onClick={() => { if (window.confirm('Tout supprimer ?')) clearAll(); }}>
          Vider
        </button>
      </header>

      {/* Visionneuse principale : swipe + boutons */}
      <div className="viewer" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button className="nav prev" onClick={() => go(-1)} disabled={clampedIndex === 0} aria-label="Précédent">‹</button>
        <div className="viewer-img">
          <img src={src} alt={`Page ${clampedIndex + 1}`} />
          {busy && <div className="viewer-busy">Traitement N&B…</div>}
          <div className="page-tag">Page {clampedIndex + 1} / {pages.length}</div>
        </div>
        <button className="nav next" onClick={() => go(1)} disabled={clampedIndex === pages.length - 1} aria-label="Suivant">›</button>
      </div>

      {/* Actions sur la photo courante */}
      <div className="viewer-tools">
        <button className={showProcessed ? 'tool active' : 'tool'} onClick={() => setShowProcessed((v) => !v)}>
          {showProcessed ? '🎨 Couleur' : '⬛ Aperçu N&B'}
        </button>
        <button className="tool" onClick={() => movePage(current.id, -1)} disabled={clampedIndex === 0}>◀ Déplacer</button>
        <button className="tool" onClick={() => movePage(current.id, 1)} disabled={clampedIndex === pages.length - 1}>Déplacer ▶</button>
        <button className="tool danger" onClick={() => removePage(current.id)}>🗑 Supprimer</button>
      </div>

      {/* Statut OCR de la page courante */}
      <OcrBadge ocr={current.ocr} />

      {/* Bande de miniatures : défilement horizontal indépendant */}
      <div className="thumb-strip" ref={thumbStripRef}>
        {pages.map((p, i) => (
          <button
            key={p.id}
            data-i={i}
            className={i === clampedIndex ? 'thumb active' : 'thumb'}
            onClick={() => { setShowProcessed(false); setIndex(i); }}
          >
            <img src={p.originalDataUrl} alt={`Miniature ${i + 1}`} />
            <span className="thumb-num">{i + 1}</span>
            {p.ocr.status === 'done' && <span className="thumb-ok">✓</span>}
          </button>
        ))}
      </div>

      {/* Barre d'action bas (la page défile verticalement au-dessus) */}
      <div className="bottom-bar">
        <button className="secondary" onClick={goCapture}>+ Photos</button>
        <button className="primary" onClick={goOcr}>
          🔎 Lancer l'OCR {ocrDone > 0 && <span className="badge">{ocrDone}/{pages.length}</span>}
        </button>
      </div>
    </div>
  );
}

function OcrBadge({ ocr }) {
  if (!ocr || ocr.status === 'pending') {
    return <div className="ocr-badge pending">OCR : en attente</div>;
  }
  if (ocr.status === 'running') {
    return (
      <div className="ocr-badge running">
        OCR : {ocr.statusText || 'en cours'} — {Math.round(ocr.progress * 100)}%
      </div>
    );
  }
  if (ocr.status === 'error') {
    return <div className="ocr-badge error">OCR : erreur — {ocr.error}</div>;
  }
  return (
    <div className="ocr-badge done">
      OCR : terminé {ocr.confidence != null && `(confiance ${Math.round(ocr.confidence)}%)`}
    </div>
  );
}
