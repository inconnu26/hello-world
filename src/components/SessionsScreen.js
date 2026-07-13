import { useState } from 'react';
import './SessionsScreen.css';

export default function SessionsScreen({
  sessions,
  createSession,
  openSession,
  removeSession,
  goSettings,
  hasKey,
}) {
  const [name, setName] = useState('');

  const create = () => {
    createSession(name.trim() || `Livre ${sessions.length + 1}`);
    setName('');
  };

  const fmtDate = (t) => {
    try {
      return new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="screen sessions">
      <header className="s-header">
        <div>
          <div className="logo-row"><span className="logo">📖</span><h1>Book Scanner OCR</h1></div>
          <p className="subtitle">Tes livres scannés. Choisis-en un ou crée-en un nouveau.</p>
        </div>
        <button className="gear" onClick={goSettings} aria-label="Réglages">⚙️</button>
      </header>

      <div className="new-book">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du livre à scanner…"
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="primary" onClick={create}>＋ Nouveau</button>
      </div>

      {!hasKey && (
        <div className="key-hint" onClick={goSettings}>
          💡 Ajoute ta clé OpenRouter dans les réglages pour débloquer les OCR cloud (Gemini, Claude…).
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">📚</div>
          <p>Aucun livre pour l'instant.</p>
          <p className="hint">Donne un nom ci-dessus et lance ton premier scan.</p>
        </div>
      ) : (
        <ul className="book-list">
          {sessions.map((s) => (
            <li key={s.id} className="book-card" onClick={() => openSession(s.id)}>
              <div className="book-thumb">
                {s.pages[0] ? <img src={s.pages[0].originalDataUrl} alt="" /> : <span>📄</span>}
              </div>
              <div className="book-info">
                <div className="book-name">{s.name}</div>
                <div className="book-meta">
                  {s.pages.length} photo{s.pages.length > 1 ? 's' : ''} · {s.runs.length} OCR ·{' '}
                  {s.homogenizations.length} mise{s.homogenizations.length > 1 ? 's' : ''} en forme
                </div>
                <div className="book-date">{fmtDate(s.updatedAt)}</div>
              </div>
              <button
                className="del"
                aria-label="Supprimer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Supprimer « ${s.name} » et toutes ses données ?`)) removeSession(s.id);
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
