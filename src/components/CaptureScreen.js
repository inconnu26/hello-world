import { useCallback, useEffect, useRef, useState } from 'react';
import './CaptureScreen.css';
import useCamera from '../hooks/useCamera';
import { captureFrame } from '../lib/imageProcessing';
import { tickSound, shutterSound, speakNumber, unlockAudio } from '../lib/audio';

export default function CaptureScreen({ settings, setSettings, pages, addPage, goHome, goGallery }) {
  const { videoRef, start, stop, active, ready, error, onLoadedMetadata } = useCamera();
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(settings.intervalSec);
  const [flash, setFlash] = useState(false);
  const [lastShot, setLastShot] = useState(null);

  // Refs pour éviter les closures périmées dans le timer.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const runningRef = useRef(false);

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCapture = useCallback(() => {
    if (!videoRef.current || !ready) return;
    try {
      const { dataUrl, width, height } = captureFrame(videoRef.current);
      addPage({ originalDataUrl: dataUrl, width, height });
      setLastShot(dataUrl);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      if (settingsRef.current.sound) shutterSound();
    } catch (e) {
      /* frame non prête : on ignore ce tour */
    }
  }, [addPage, ready, videoRef]);

  // Boucle du compte à rebours (1 tick / seconde).
  useEffect(() => {
    if (!running) return undefined;
    runningRef.current = true;
    setCount(settingsRef.current.intervalSec);

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

    return () => {
      runningRef.current = false;
      clearInterval(id);
    };
  }, [running, doCapture]);

  const toggleRun = () => {
    unlockAudio();
    setRunning((r) => !r);
  };

  const clampInterval = (v) => Math.max(2, Math.min(10, v));

  return (
    <div className="screen capture">
      {/* Aperçu vidéo temps réel : toujours affiché */}
      <div className="preview-wrap">
        <video
          ref={videoRef}
          className="preview"
          autoPlay
          playsInline
          muted
          onLoadedMetadata={onLoadedMetadata}
        />

        {/* Repères de cadrage */}
        <div className="frame-guide" />

        {flash && <div className="flash" />}

        {/* Grand compte à rebours */}
        {running && (
          <div className="countdown">
            <span className="count-num">{count}</span>
          </div>
        )}

        {/* Barre d'état haute */}
        <div className="top-bar">
          <button className="ghost-btn" onClick={goHome}>
            ‹ Retour
          </button>
          <div className="status-pill">
            {!active && !error && '⏳ Ouverture caméra…'}
            {active && !ready && '⏳ Initialisation…'}
            {active && ready && !running && '● Prêt'}
            {running && '🔴 Rafale en cours'}
          </div>
          <div className="shot-count">📸 {pages.length}</div>
        </div>

        {error && (
          <div className="cam-error">
            <p>{error}</p>
            <button className="secondary" onClick={start}>
              Réessayer
            </button>
          </div>
        )}

        {/* Dernière photo prise (miniature) */}
        {lastShot && (
          <div className="last-shot" onClick={goGallery} title="Voir les photos">
            <img src={lastShot} alt="Dernière capture" />
          </div>
        )}
      </div>

      {/* Contrôles bas */}
      <div className="controls">
        <div className="interval-mini">
          <button
            className="mini-btn"
            onClick={() => set({ intervalSec: clampInterval(settings.intervalSec - 1) })}
            disabled={running}
          >
            −
          </button>
          <span className="mini-value">{settings.intervalSec}s</span>
          <button
            className="mini-btn"
            onClick={() => set({ intervalSec: clampInterval(settings.intervalSec + 1) })}
            disabled={running}
          >
            +
          </button>
        </div>

        <button
          className={running ? 'shoot stop' : 'shoot'}
          onClick={toggleRun}
          disabled={!ready}
        >
          {running ? '■' : '▶'}
        </button>

        <button className="manual-btn" onClick={doCapture} disabled={!ready}>
          Photo
        </button>
      </div>

      <button className="gallery-link" onClick={goGallery} disabled={pages.length === 0}>
        Voir mes {pages.length} photo{pages.length > 1 ? 's' : ''} →
      </button>
    </div>
  );
}
