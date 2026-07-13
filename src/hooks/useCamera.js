import { useCallback, useEffect, useRef, useState } from 'react';

// Gère l'accès à la caméra et fournit un flux temps réel à brancher sur un
// <video>. facingMode 'environment' = caméra arrière (idéale pour scanner).
export default function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setReady(false);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("La caméra n'est pas accessible sur ce navigateur (HTTPS requis).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setActive(true);
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        setError("Accès caméra refusé. Autorise la caméra dans les réglages du navigateur.");
      } else if (e && e.name === 'NotFoundError') {
        setError('Aucune caméra détectée sur cet appareil.');
      } else {
        setError('Erreur caméra : ' + (e && e.message ? e.message : String(e)));
      }
      setActive(false);
    }
  }, []);

  // Nettoyage à la destruction du composant.
  useEffect(() => () => stop(), [stop]);

  const onLoadedMetadata = useCallback(() => setReady(true), []);

  return { videoRef, start, stop, active, ready, error, onLoadedMetadata };
}
