import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import SessionsScreen from './components/SessionsScreen';
import SettingsScreen from './components/SettingsScreen';
import CaptureScreen from './components/CaptureScreen';
import SessionScreen from './components/SessionScreen';
import OcrRunScreen from './components/OcrRunScreen';
import HomogenizeScreen from './components/HomogenizeScreen';
import { getAllSessions, putSession, deleteSession } from './lib/storage';
import { newSession } from './lib/sessionModel';

const DEFAULT_SETTINGS = {
  intervalSec: 4,
  sound: true,
  voice: true,
  threshold: 0.5,
  lang: 'fra',
  openrouterKey: '',
};

function loadSettings() {
  try {
    const raw = localStorage.getItem('scan.settings.v2');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(loadSettings);
  const [nav, setNav] = useState({ screen: 'sessions' });

  // Chargement initial depuis IndexedDB.
  useEffect(() => {
    getAllSessions()
      .then((list) => setSessions(list.sort((a, b) => b.updatedAt - a.updatedAt)))
      .catch(() => setSessions([]))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('scan.settings.v2', JSON.stringify(settings));
    } catch (e) {
      /* ignore */
    }
  }, [settings]);

  // Enregistre (ou insère) une session et la persiste.
  const saveSession = useCallback((session) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === session.id);
      const next = exists ? prev.map((s) => (s.id === session.id ? session : s)) : [session, ...prev];
      return next;
    });
    putSession(session).catch(() => {});
  }, []);

  const removeSession = useCallback((id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    deleteSession(id).catch(() => {});
  }, []);

  const createSession = useCallback(
    (name) => {
      const s = newSession({ name });
      saveSession(s);
      return s;
    },
    [saveSession]
  );

  const go = useCallback((screen, params = {}) => setNav({ screen, ...params }), []);

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === nav.sessionId) || null,
    [sessions, nav.sessionId]
  );

  if (!ready) {
    return (
      <div className="app">
        <div className="splash">📖 Chargement…</div>
      </div>
    );
  }

  return (
    <div className="app">
      {nav.screen === 'sessions' && (
        <SessionsScreen
          sessions={sessions}
          createSession={(name) => {
            const s = createSession(name);
            go('capture', { sessionId: s.id });
          }}
          openSession={(id) => go('session', { sessionId: id })}
          removeSession={removeSession}
          goSettings={() => go('settings')}
          hasKey={!!settings.openrouterKey}
        />
      )}

      {nav.screen === 'settings' && (
        <SettingsScreen settings={settings} setSettings={setSettings} goBack={() => go('sessions')} />
      )}

      {nav.screen === 'capture' && currentSession && (
        <CaptureScreen
          session={currentSession}
          settings={settings}
          setSettings={setSettings}
          saveSession={saveSession}
          goSession={() => go('session', { sessionId: currentSession.id })}
        />
      )}

      {nav.screen === 'session' && currentSession && (
        <SessionScreen
          session={currentSession}
          settings={settings}
          saveSession={saveSession}
          goHome={() => go('sessions')}
          goCapture={() => go('capture', { sessionId: currentSession.id })}
          goNewOcr={() => go('ocr', { sessionId: currentSession.id, runId: 'new' })}
          goRun={(runId) => go('ocr', { sessionId: currentSession.id, runId })}
          goHomogenize={(homId) => go('homogenize', { sessionId: currentSession.id, homId: homId || 'new' })}
          goSettings={() => go('settings')}
        />
      )}

      {nav.screen === 'ocr' && currentSession && (
        <OcrRunScreen
          session={currentSession}
          settings={settings}
          setSettings={setSettings}
          saveSession={saveSession}
          runId={nav.runId}
          goSession={() => go('session', { sessionId: currentSession.id })}
        />
      )}

      {nav.screen === 'homogenize' && currentSession && (
        <HomogenizeScreen
          session={currentSession}
          settings={settings}
          setSettings={setSettings}
          saveSession={saveSession}
          homId={nav.homId}
          goSession={() => go('session', { sessionId: currentSession.id })}
        />
      )}

      {/* Sécurité : si la session ciblée n'existe plus */}
      {['capture', 'session', 'ocr', 'homogenize'].includes(nav.screen) && !currentSession && (
        <div className="screen">
          <p>Session introuvable.</p>
          <button className="primary" onClick={() => go('sessions')}>Retour à l'accueil</button>
        </div>
      )}
    </div>
  );
}
