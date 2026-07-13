import { useCallback, useEffect, useRef, useState } from 'react';
import './CaptureScreen.css';
import useCamera from '../hooks/useCamera';
import { captureFrame } from '../lib/imageProcessing';
import { tickSound, shutterSound, speakNumber, unlockAudio } from '../lib/audio';
import { addPages, replacePage } from '../lib/sessionModel';

export default function CaptureScreen({ session, settings, setSettings, saveSession, replacePageId, goSession }) {
  const { videoRef, start, stop, active, ready, error, onLoadedMetadata } = useCamera();
  const [phase, setPhase] = useState('idle'); // idle | running | paused
  const [count, setCount] = useState(settings.intervalSec);
  const [flash, setFlash] = useState(false);
  const [lastShot, setLastShot] = useState(null);
  const [shotCount, setShotCount] = useState(session.pages.length);

  const orientation = session.orientation || 'portrait';
  const dir = session.landscapeDir || 'left';
  // Angle pour redresser la photo (téléphone tourné à 90°) et pour l'interface.
  const imageDeg = orientation === 'landscape' ? (dir === 'left' ? -90 : 90) : 0;
  const uiDeg = -imageDeg;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionRef = useRef(session);
  const imageDegRef = useRef(imageDeg);
  imageDegRef.current = imageDeg;
  useEffect(() => {
    sessionRef.current = session;
    setShotCount(session.pages.length);
  }, [session]);

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const patchSession = (patch) => {
    const next = { ...sessionRef.current, ...patch };
    sessionRef.current = next;
    saveSession(next);
  };

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCapture = useCallback(() => {
    if (!videoRef.current || !ready) return;
    try {
      const { dataUrl, width, height } = captureFrame(videoRef.current, { rotate: imageDegRef.current });
      if (settingsRef.current.sound) shutterSound();
      // Mode remplacement : on remplace UNE photo puis on revient au livre.
      if (replacePageId) {
        const next = replacePage(sessionRef.current, replacePageId, { originalDataUrl: dataUrl, width, height });
        sessionRef.current = next;
        saveSession(next);
        setFlash(true);
        setTimeout(() => { setFlash(false); goSession(); }, 250);
        return;
      }
      const next = addPages(sessionRef.current, [{ originalDataUrl: dataUrl, width, height }]);
      sessionRef.current = next;
      saveSession(next);
      setShotCount(next.pages.length);
      setLastShot(dataUrl);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    } catch (e) {
      /* frame non prête */
    }
  }, [ready, saveSession, videoRef, replacePageId, goSession]);

  // Décompte : tourne uniquement en phase "running". La pause fige `count`.
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const id = setInterval(() => {
      setCount((c) => {
        const next = c - 1;
        if (next <= 0) {
          doCapture();
          return settingsRef.current.intervalSec;
        }
        if (next <= 3) {
          if (settingsRef.current.sound) tickSound();
          speakNumber(next, settingsRef.current.voice);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, doCapture]);

  const startRun = () => { unlockAudio(); setCount(settingsRef.current.intervalSec); setPhase('running'); };
  const stopRun = () => setPhase('idle');
  const pauseRun = () => setPhase('paused');
  const resumeRun = () => { unlockAudio(); setPhase('running'); }; // garde `count`

  const clampInterval = (v) => Math.max(2, Math.min(10, v));
  const idle = phase === 'idle';

  const layerStyle =
    orientation === 'landscape'
      ? { top: '50%', left: '50%', width: '100vh', height: '100vw', transform: `translate(-50%, -50%) rotate(${uiDeg}deg)` }
      : undefined;

  return (
    <div className={`screen capture ${orientation === 'landscape' ? 'landscape' : ''}`}>
      <video ref={videoRef} className="preview" autoPlay playsInline muted onLoadedMetadata={onLoadedMetadata} />

      <div className="ui-layer" style={layerStyle}>
        {flash && <div className="flash" />}
        {phase !== 'idle' && (
          <div className="countdown">
            <span className="count-num">{count}</span>
            {phase === 'paused' && <span className="paused-tag">EN PAUSE</span>}
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
          </div>
          <div className="shot-count">📸 {shotCount}</div>
        </div>

        {replacePageId && (
          <div className="replace-banner">
            🔄 Remplacement de la page {session.pages.findIndex((p) => p.id === replacePageId) + 1} — prends une nouvelle photo
          </div>
        )}

        {/* Sélecteur d'orientation (seulement à l'arrêt, hors remplacement) */}
        {idle && !replacePageId && (
          <div className="orient-bar">
            <button className={orientation === 'portrait' ? 'orient sel' : 'orient'} onClick={() => patchSession({ orientation: 'portrait' })}>📱 Portrait</button>
            <button className={orientation === 'landscape' ? 'orient sel' : 'orient'} onClick={() => patchSession({ orientation: 'landscape' })}>🖥️ Paysage</button>
            {orientation === 'landscape' && (
              <button className="orient dir" onClick={() => patchSession({ landscapeDir: dir === 'left' ? 'right' : 'left' })}>
                Sens {dir === 'left' ? '⟲' : '⟳'}
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="cam-error">
            <p>{error}</p>
            <button className="secondary" onClick={start}>Réessayer</button>
          </div>
        )}

        {lastShot && (
          <div className="last-shot" onClick={goSession} title="Voir le livre">
            <img src={lastShot} alt="Dernière capture" />
          </div>
        )}

        <div className="bottom-stack">
          <div className="controls">
            <div className="interval-mini">
              <button className="mini-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec - 1) })} disabled={!idle}>−</button>
              <span className="mini-value">{settings.intervalSec}s</span>
              <button className="mini-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec + 1) })} disabled={!idle}>＋</button>
            </div>

            {/* Bouton pause/reprise (côté), actif pendant la rafale */}
            <button
              className="pause-btn"
              onClick={phase === 'running' ? pauseRun : resumeRun}
              disabled={idle}
              title={phase === 'running' ? 'Pause' : 'Reprendre'}
            >
              {phase === 'running' ? '⏸' : '▶︎'}
            </button>

            {/* Bouton principal start/stop */}
            <button className={idle ? 'shoot' : 'shoot stop'} onClick={idle ? startRun : stopRun} disabled={!ready}>
              {idle ? '▶' : '■'}
            </button>

            <button className="manual-btn" onClick={doCapture} disabled={!ready}>Photo</button>
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
