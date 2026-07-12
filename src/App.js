import { useCallback, useEffect, useState } from 'react';
import './App.css';
import HomeScreen from './components/HomeScreen';
import CaptureScreen from './components/CaptureScreen';
import GalleryScreen from './components/GalleryScreen';
import OcrScreen from './components/OcrScreen';
import * as session from './lib/session';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [settings, setSettings] = useState(() => session.loadSettings(window.localStorage));
  const [pages, setPages] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem('scan.settings', JSON.stringify(settings));
    } catch (e) {
      /* ignore */
    }
  }, [settings]);

  const addPage = useCallback((page) => {
    setPages((prev) => session.addPage(prev, page));
  }, []);

  const updatePage = useCallback((id, patch) => {
    setPages((prev) => session.updatePage(prev, id, patch));
  }, []);

  const removePage = useCallback((id) => {
    setPages((prev) => session.removePage(prev, id));
  }, []);

  const movePage = useCallback((id, dir) => {
    setPages((prev) => session.movePage(prev, id, dir));
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
