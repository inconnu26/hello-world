import { useState } from 'react';
import './SettingsScreen.css';
import { validateKey, testConnection } from '../lib/openrouter';
import { LOCAL_LANGS } from '../lib/models';

export default function SettingsScreen({ settings, setSettings, goBack }) {
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const [keyInput, setKeyInput] = useState(settings.openrouterKey || '');
  const [checking, setChecking] = useState(false);
  const [keyResult, setKeyResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [connResult, setConnResult] = useState(null);
  const clampInterval = (v) => Math.max(2, Math.min(10, v));

  const testConn = async () => {
    setTesting(true);
    setConnResult(null);
    const res = await testConnection((keyInput || settings.openrouterKey || '').trim());
    setConnResult(res);
    setTesting(false);
  };

  const check = async () => {
    setChecking(true);
    setKeyResult(null);
    const res = await validateKey(keyInput.trim());
    setKeyResult(res);
    if (res.valid) set({ openrouterKey: keyInput.trim() });
    setChecking(false);
  };

  const clearKey = () => {
    setKeyInput('');
    setKeyResult(null);
    set({ openrouterKey: '' });
  };

  return (
    <div className="screen settings">
      <header className="set-header">
        <button className="ghost-btn" onClick={goBack}>‹ Retour</button>
        <h1>Réglages</h1>
        <span />
      </header>

      <section className="card">
        <h2>Capture par défaut</h2>
        <div className="stepper">
          <button className="step-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec - 1) })}>−</button>
          <div className="step-value"><span className="num">{settings.intervalSec}</span><span className="unit">secondes / photo</span></div>
          <button className="step-btn" onClick={() => set({ intervalSec: clampInterval(settings.intervalSec + 1) })}>＋</button>
        </div>
        <label className="row toggle"><span>Bips du compte à rebours</span>
          <input type="checkbox" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} /></label>
        <label className="row toggle"><span>Annonce vocale « 3, 2, 1 »</span>
          <input type="checkbox" checked={settings.voice} onChange={(e) => set({ voice: e.target.checked })} /></label>
        <label className="row column">
          <span>Contraste N&B pour l'OCR local <b>{Math.round(settings.threshold * 100)}%</b></span>
          <input type="range" min="0" max="1" step="0.05" value={settings.threshold}
            onChange={(e) => set({ threshold: parseFloat(e.target.value) })} />
        </label>
        <label className="row">
          <span>Langue (OCR local)</span>
          <select value={settings.lang} onChange={(e) => set({ lang: e.target.value })}>
            {LOCAL_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Clé OpenRouter</h2>
        <p className="hint">
          Nécessaire pour les moteurs OCR cloud (Gemini, Claude, GPT…) et l'homogénéisation par IA.
          La clé est stockée uniquement sur cet appareil. Obtiens-en une sur openrouter.ai/keys.
        </p>
        <div className="key-row">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-or-v1-…"
            autoComplete="off"
          />
          <button className="secondary small" onClick={check} disabled={checking || !keyInput.trim()}>
            {checking ? '…' : 'Vérifier'}
          </button>
        </div>
        {keyResult && (
          <div className={keyResult.valid ? 'key-status ok' : 'key-status err'}>
            {keyResult.valid
              ? `✓ Clé valide (${keyResult.label})`
              : `✗ ${keyResult.error}`}
          </div>
        )}
        <button className="secondary small test-conn" onClick={testConn} disabled={testing || !(keyInput || settings.openrouterKey).trim()}>
          {testing ? 'Test en cours…' : '🔌 Tester la connexion (vrai appel)'}
        </button>
        {connResult && (
          <div className={connResult.ok ? 'key-status ok' : 'key-status err'}>
            {connResult.ok
              ? `✓ Connexion OK — le modèle a répondu : « ${connResult.reply} »`
              : `✗ ${connResult.error}`}
          </div>
        )}

        {settings.openrouterKey && (
          <button className="link-btn danger" onClick={clearKey}>Supprimer la clé enregistrée</button>
        )}
        <p className="warn">
          ⚠️ Avec un moteur cloud, les photos et le texte sont envoyés à OpenRouter (ils quittent
          l'appareil). Le moteur Tesseract local reste 100 % privé.
        </p>
      </section>
    </div>
  );
}
