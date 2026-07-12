import './HomeScreen.css';

export default function HomeScreen({ settings, setSettings, pageCount, goCapture, goGallery }) {
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const clampInterval = (v) => Math.max(2, Math.min(10, v));

  return (
    <div className="screen home">
      <header className="home-header">
        <div className="logo">📖</div>
        <h1>Book Scanner OCR</h1>
        <p className="subtitle">
          Scanne tes livres en rafale, puis extrais le texte en PDF — entièrement sur ton
          téléphone, sans envoyer d'image sur internet.
        </p>
      </header>

      <section className="card">
        <h2>Fréquence de capture</h2>
        <p className="hint">Une photo sera prise automatiquement à cet intervalle.</p>
        <div className="stepper">
          <button
            className="step-btn"
            aria-label="Diminuer"
            onClick={() => set({ intervalSec: clampInterval(settings.intervalSec - 1) })}
          >
            −
          </button>
          <div className="step-value">
            <span className="num">{settings.intervalSec}</span>
            <span className="unit">secondes</span>
          </div>
          <button
            className="step-btn"
            aria-label="Augmenter"
            onClick={() => set({ intervalSec: clampInterval(settings.intervalSec + 1) })}
          >
            +
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Sons</h2>
        <label className="row toggle">
          <span>Bips du compte à rebours</span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => set({ sound: e.target.checked })}
          />
        </label>
        <label className="row toggle">
          <span>Annonce vocale « 3, 2, 1 »</span>
          <input
            type="checkbox"
            checked={settings.voice}
            onChange={(e) => set({ voice: e.target.checked })}
          />
        </label>
      </section>

      <section className="card">
        <h2>OCR</h2>
        <label className="row">
          <span>Langue du texte</span>
          <select value={settings.lang} onChange={(e) => set({ lang: e.target.value })}>
            <option value="fra">Français</option>
            <option value="eng">Anglais</option>
            <option value="fra+eng">Français + Anglais</option>
            <option value="heb">Hébreu</option>
          </select>
        </label>
        <label className="row column">
          <span>
            Contraste du noir &amp; blanc <b>{Math.round(settings.threshold * 100)}%</b>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.threshold}
            onChange={(e) => set({ threshold: parseFloat(e.target.value) })}
          />
          <span className="hint">
            Plus élevé = plus de pixels deviennent noirs. À ajuster selon le papier.
          </span>
        </label>
      </section>

      <div className="actions">
        <button className="primary big" onClick={goCapture}>
          📷 Démarrer le scan
        </button>
        <button className="secondary" onClick={goGallery}>
          🖼️ Mes photos {pageCount > 0 && <span className="badge">{pageCount}</span>}
        </button>
      </div>

      <footer className="home-footer">
        Astuce : pose le livre bien à plat sous le téléphone, vérifie le cadrage grâce à
        l'aperçu en temps réel avant de lancer la rafale.
      </footer>
    </div>
  );
}
