import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { toHighContrast, captureFrame, cropFrame } from './lib/imageProcessing';
import { recognizePage } from './lib/ocr';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// API de test exposée uniquement quand l'URL contient ?e2e — permet aux tests
// end-to-end d'exercer les vraies fonctions de l'app dans un navigateur réel.
// Aucun effet en production.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e')) {
  window.__TEST_API__ = { toHighContrast, captureFrame, cropFrame, recognizePage };
}
