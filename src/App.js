import { useCallback, useEffect, useState } from 'react';
import './App.css';
import HomeScreen from './components/HomeScreen';
import CaptureScreen from './components/CaptureScreen';
import GalleryScreen from './components/GalleryScreen';
import OcrScreen from './components/OcrScreen';

const DEFAULT_SETTINGS = {
  intervalSec: 4,
  sound: true,
  voice: true,
  lang: 'fra',
  threshold: 0.5,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem('scan.settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

let idCounter = 0;
export function nextId() {
  idCounter += 1;
  return `p${Date.now()}_${idCounter}`;
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [settings, setSettings] = useState(loadSettings);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem('scan.settings', JSON.stringify(settings));
    } catch (e) {
      /* ignore */
    }
  }, [settings]);

  const addPage = useCallback((page) => {
    setPages((prev) => [
      ...prev,
      {
        id: nextId(),
        ...page,
        ocr: { status: 'pending', progress: 0, statusText: '', text: '', confidence: null, error: null },
      },
    ]);
  }, []);

  const updatePage = useCallback((id, patch) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch, ocr: patch.ocr ? { ...p.ocr, ...patch.ocr } : p.ocr } : p))
    );
  }, []);

  const removePage = useCallback((id) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const movePage = useCallback((id, dir) => {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }, []);

  const clearAll = useCallback(() => setPages([]), []);

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          settings={settings}
          setSettings={setSettings}
          pageCount={pages.length}
          goCapture={() => setScreen('capture')}
          goGallery={() => setScreen('gallery')}
        />
      )}
      {screen === 'capture' && (
        <CaptureScreen
          settings={settings}
          setSettings={setSettings}
          pages={pages}
          addPage={addPage}
          goHome={() => setScreen('home')}
          goGallery={() => setScreen('gallery')}
        />
      )}
      {screen === 'gallery' && (
        <GalleryScreen
          pages={pages}
          settings={settings}
          updatePage={updatePage}
          removePage={removePage}
          movePage={movePage}
          clearAll={clearAll}
          goHome={() => setScreen('home')}
          goCapture={() => setScreen('capture')}
          goOcr={() => setScreen('ocr')}
        />
      )}
      {screen === 'ocr' && (
        <OcrScreen
          pages={pages}
          settings={settings}
          updatePage={updatePage}
          goGallery={() => setScreen('gallery')}
        />
      )}
    </div>
  );
}
