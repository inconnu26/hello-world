import { useCallback, useEffect, useRef, useState } from 'react';
import './CaptureScreen.css';
import useCamera from '../hooks/useCamera';
import { captureFrame } from '../lib/imageProcessing';
import { tickSound, shutterSound, speakNumber, unlockAudio } from '../lib/audio';
import { addPages } from '../lib/sessionModel';

export default function CaptureScreen({ session, settings, setSettings, saveSession, goSession }) {
  const { videoRef, start, stop, active, ready, error, onLoadedMetadata } = useCamera();
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(settings.intervalSec);
  const [flash, setFlash] = useState(false);
  const [lastShot, setLastShot] = useState(null);
  const [shotCount, setShotCount] = useState(session.pages.length);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionRef = useRef(session);
  // garde la dernière version connue de la session (hors captures) à jour
  useEffect(() => {
    sessionRef.current = session;
    setShotCount(session.pages.length);
  }, [session]);

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
      const next = addPages(sessionRef.current, [{ originalDataUrl: dataUrl, width, height }]);
      sessionRef.current = next;
      saveSession(next);
      setShotCount(next.pages.length);
      setLastShot(dataUrl);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      if (settingsRef.current.sound) shutterSound();
    } catch (e) {
      /* frame non prête */
    }
  }, [ready, saveSession, videoRef]);

  useEffect(() => {
    if (!running) return undefined;
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
    return () => clearInterval(id);
  }, [running, doCapture]);

  const toggleRun = () => {
    unlockAudio();
    setRunning((r) => !r);
  };
  const clampInterval = (v) => Math.max(2, Math.min(10, v));

  return (
    <div className="screen capture">
      <div className="preview-wrap">
        <video ref={videoRef} className="preview" autoPlay playsInline muted onLoadedMetadata={onLoadedMetadata} />
        <div className="frame-guide" />
        {flash && <div className="flash" />}
        {running && <div className="countdown"><span className="count-num">{count}</span></div>}

        <div className="top-bar">
          <button className="ghost-btn" onClick={goSession}>‹ {session.name}</button>
          <div className="status-pill">
            {!active && !error && '⏳ Caméra…'}
            {active && !ready && '⏳ Init…'}
            {active && ready && !running && '● Prêt'}
            {running && '🔴 Rafale'}
          </div>
          <div className="shot-count">📸 {shotCount}</div>
        </div>

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
      </div>

      <div className="controls">
        <div className="interval-mini">
          <button className="mini-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec - 1) })} disabled={running}>−</button>
          <span className="mini-value">{settings.intervalSec}s</span>
          <button className="mini-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec + 1) })} disabled={running}>＋</button>
        </div>
        <button className={running ? 'shoot stop' : 'shoot'} onClick={toggleRun} disabled={!ready}>
          {running ? '■' : '▶'}
        </button>
        <button className="manual-btn" onClick={doCapture} disabled={!ready}>Photo</button>
      </div>

      <button className="gallery-link" onClick={goSession}>
        Terminer — voir le livre ({shotCount} photo{shotCount > 1 ? 's' : ''}) →
      </button>
    </div>
  );
}
