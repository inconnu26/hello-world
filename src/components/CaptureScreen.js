import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CaptureScreen.css';
import useCamera from '../hooks/useCamera';
import { cropFrame, toHighContrast } from '../lib/imageProcessing';
import { tickSound, shutterSound, speakNumber, unlockAudio } from '../lib/audio';
import { addPages, replacePage, removePage } from '../lib/sessionModel';

const A4 = 0.7071; // ratio largeur/hauteur d'une page portrait (A4)
const REVIEW_MS = 1300; // durée de l'aperçu N&B après capture

// Calcule les rectangles de cadrage (en px écran) selon le mode.
function computeGuides(W, H, mode) {
  if (!W || !H) return null;
  if (mode === 'double') {
    const gap = Math.max(12, W * 0.03);
    const maxH = H * 0.9;
    const eachMaxW = (W * 0.94 - gap) / 2;
    let gh = maxH;
    let gw = gh * A4;
    if (gw > eachMaxW) { gw = eachMaxW; gh = gw / A4; }
    const totalW = gw * 2 + gap;
    const startX = (W - totalW) / 2;
    const y = (H - gh) / 2;
    return { left: { x: startX, y, w: gw, h: gh }, right: { x: startX + gw + gap, y, w: gw, h: gh } };
  }
  const maxW = W * 0.9;
  const maxH = H * 0.9;
  let gh = maxH;
  let gw = gh * A4;
  if (gw > maxW) { gw = maxW; gh = gw / A4; }
  return { single: { x: (W - gw) / 2, y: (H - gh) / 2, w: gw, h: gh } };
}

export default function CaptureScreen({ session, settings, setSettings, saveSession, replacePageId, goSession }) {
  const { videoRef, start, stop, active, ready, error, onLoadedMetadata } = useCamera();
  const [phase, setPhase] = useState('idle'); // idle | running | paused | review
  const [count, setCount] = useState(settings.intervalSec);
  const [flash, setFlash] = useState(false);
  const [shotCount, setShotCount] = useState(session.pages.length);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [review, setReview] = useState(null); // { images:[dataUrl], pageIds:[], returnTo:'running'|'idle' }

  const mode = replacePageId ? 'single' : (session.captureMode || 'single');

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionRef = useRef(session);
  const countRef = useRef(count);
  countRef.current = count;
  const reviewTimerRef = useRef(null);
  const doCaptureRef = useRef(null);

  useEffect(() => { sessionRef.current = session; setShotCount(session.pages.length); }, [session]);

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const patchSession = (patch) => {
    const next = { ...sessionRef.current, ...patch };
    sessionRef.current = next;
    saveSession(next);
  };

  useEffect(() => {
    start();
    return () => { stop(); if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mesure la taille d'affichage de la vidéo (pour le mapping du crop).
  const measure = useCallback(() => {
    const v = videoRef.current;
    if (v) setSize({ w: v.clientWidth, h: v.clientHeight });
  }, [videoRef]);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [measure]);

  const guides = useMemo(() => computeGuides(size.w, size.h, mode), [size, mode]);

  const endReview = useCallback((keep) => {
    if (reviewTimerRef.current) { clearTimeout(reviewTimerRef.current); reviewTimerRef.current = null; }
    setReview((r) => {
      if (!r) return null;
      if (!keep) {
        // Annulation : retire la/les page(s) qu'on venait d'ajouter.
        let next = sessionRef.current;
        r.pageIds.forEach((id) => { next = removePage(next, id); });
        sessionRef.current = next;
        saveSession(next);
        setShotCount(next.pages.length);
      }
      if (r.returnTo === 'running') { setCount(settingsRef.current.intervalSec); setPhase('running'); }
      else setPhase('idle');
      return null;
    });
  }, [saveSession]);

  const doCapture = useCallback((fromRafale) => {
    const v = videoRef.current;
    if (!v || !ready || !guides) return;
    try {
      let shots = [];
      if (mode === 'double' && guides.left && guides.right) {
        shots = [cropFrame(v, guides.left, size.w, size.h), cropFrame(v, guides.right, size.w, size.h)];
      } else {
        shots = [cropFrame(v, guides.single, size.w, size.h)];
      }
      if (settingsRef.current.sound) shutterSound();
      setFlash(true);
      setTimeout(() => setFlash(false), 160);

      // Mode remplacement : remplace une page, pas d'aperçu, retour au livre.
      if (replacePageId) {
        const first = shots[0];
        const next = replacePage(sessionRef.current, replacePageId, { originalDataUrl: first.dataUrl, width: first.width, height: first.height });
        sessionRef.current = next;
        saveSession(next);
        setTimeout(() => goSession(), 250);
        return;
      }

      // Ajoute la/les page(s) et récupère leurs id.
      const before = sessionRef.current.pages.length;
      const next = addPages(sessionRef.current, shots.map((s) => ({ originalDataUrl: s.dataUrl, width: s.width, height: s.height })));
      sessionRef.current = next;
      saveSession(next);
      setShotCount(next.pages.length);
      const pageIds = next.pages.slice(before).map((p) => p.id);

      // Aperçu N&B pendant ~1,3 s avec possibilité d'annuler.
      setReview({ images: shots.map((s) => s.dataUrl), pageIds, returnTo: fromRafale ? 'running' : 'idle' });
      setPhase('review');
      reviewTimerRef.current = setTimeout(() => endReview(true), REVIEW_MS);
      // Calcule les rendus N&B et les affiche quand prêts.
      Promise.all(shots.map((s) => toHighContrast(s.dataUrl, { threshold: settingsRef.current.threshold }).then((r) => r.dataUrl).catch(() => s.dataUrl)))
        .then((bw) => setReview((r) => (r ? { ...r, images: bw } : r)));
    } catch (e) {
      /* frame non prête */
    }
  }, [ready, guides, mode, size, replacePageId, saveSession, goSession, videoRef, endReview]);
  doCaptureRef.current = doCapture;

  // Décompte (tourne seulement en phase "running").
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const id = setInterval(() => {
      const next = countRef.current - 1;
      if (next <= 0) {
        countRef.current = settingsRef.current.intervalSec;
        setCount(settingsRef.current.intervalSec);
        doCaptureRef.current(true);
      } else {
        countRef.current = next;
        setCount(next);
        if (next <= 3) {
          if (settingsRef.current.sound) tickSound();
          speakNumber(next, settingsRef.current.voice);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const startRun = () => { unlockAudio(); setCount(settingsRef.current.intervalSec); countRef.current = settingsRef.current.intervalSec; setPhase('running'); };
  const stopRun = () => setPhase('idle');
  const pauseRun = () => setPhase('paused');
  const resumeRun = () => { unlockAudio(); setPhase('running'); };

  const clampInterval = (v) => Math.max(2, Math.min(10, v));
  const idle = phase === 'idle';

  return (
    <div className="screen capture">
      <video ref={videoRef} className="preview" autoPlay playsInline muted onLoadedMetadata={() => { onLoadedMetadata(); measure(); }} />

      <div className="ui-layer">
        {/* Cadres de rognage */}
        {guides && phase !== 'review' && (
          <div className="guides">
            {guides.single && <div className="guide" style={rectStyle(guides.single)}><span className="guide-tag">Cadre la zone de texte</span></div>}
            {guides.left && <div className="guide" style={rectStyle(guides.left)}><span className="guide-tag">Page gauche</span></div>}
            {guides.right && <div className="guide" style={rectStyle(guides.right)}><span className="guide-tag">Page droite</span></div>}
          </div>
        )}

        {flash && <div className="flash" />}
        {phase !== 'idle' && phase !== 'review' && (
          <div className="countdown">
            <span className="count-num">{count}</span>
            {phase === 'paused' && <span className="paused-tag">EN PAUSE</span>}
          </div>
        )}

        {/* Aperçu N&B après capture avec annulation */}
        {phase === 'review' && review && (
          <div className="review">
            <div className="review-imgs">
              {review.images.map((src, i) => <img key={i} src={src} alt={`Aperçu ${i + 1}`} />)}
            </div>
            <div className="review-actions">
              <button className="review-cancel" onClick={() => endReview(false)}>✗ Annuler &amp; reprendre</button>
              <button className="review-ok" onClick={() => endReview(true)}>✓ OK</button>
            </div>
          </div>
        )}

        <div className="top-bar">
          <button className="ghost-btn" onClick={goSession}>‹ {session.name}</button>
          <div className="status-pill">
            {!active && !error && '⏳ Caméra…'}
            {active && !ready && '⏳ Init…'}
            {active && ready && idle && '● Prêt'}
            {phase === 'running' && '🔴 Rafale'}
            {phase === 'paused' && '⏸ Pause'}
            {phase === 'review' && '🔎 Vérifie'}
          </div>
          <div className="shot-count">📸 {shotCount}</div>
        </div>

        {replacePageId && (
          <div className="replace-banner">
            🔄 Remplacement de la page {session.pages.findIndex((p) => p.id === replacePageId) + 1} — prends une nouvelle photo
          </div>
        )}

        {idle && !replacePageId && (
          <div className="orient-bar">
            <button className={mode === 'single' ? 'orient sel' : 'orient'} onClick={() => patchSession({ captureMode: 'single' })}>📄 Une page</button>
            <button className={mode === 'double' ? 'orient sel' : 'orient'} onClick={() => patchSession({ captureMode: 'double' })}>📖 Livre ouvert</button>
          </div>
        )}

        {error && (
          <div className="cam-error">
            <p>{error}</p>
            <button className="secondary" onClick={start}>Réessayer</button>
          </div>
        )}

        <div className="bottom-stack">
          <div className="controls">
            <div className="interval-mini">
              <button className="mini-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec - 1) })} disabled={!idle}>−</button>
              <span className="mini-value">{settings.intervalSec}s</span>
              <button className="mini-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec + 1) })} disabled={!idle}>＋</button>
            </div>
            <button className="pause-btn" onClick={phase === 'running' ? pauseRun : resumeRun} disabled={idle || phase === 'review'} title={phase === 'running' ? 'Pause' : 'Reprendre'}>
              {phase === 'running' ? '⏸' : '▶︎'}
            </button>
            <button className={idle ? 'shoot' : 'shoot stop'} onClick={idle ? startRun : stopRun} disabled={!ready || phase === 'review'}>
              {idle ? '▶' : '■'}
            </button>
            <button className="manual-btn" onClick={() => doCapture(false)} disabled={!ready || phase === 'review'}>Photo</button>
          </div>

          <button className="gallery-link" onClick={goSession}>
            {replacePageId
              ? 'Annuler le remplacement →'
              : `Terminer — voir le livre (${shotCount} photo${shotCount > 1 ? 's' : ''}) →`}
          </button>
        </div>
      </div>
    </div>
  );
}

function rectStyle(r) {
  return { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` };
}
