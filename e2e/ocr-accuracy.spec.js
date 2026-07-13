const { test, expect } = require('@playwright/test');

// Vérifie que l'OCR reconnaît réellement du texte, via la vraie chaîne de l'app
// (post-traitement N&B puis recognizePage), exposée en navigateur via ?e2e.
// Preuve de bout en bout que le moteur OCR embarqué fonctionne hors-ligne.
test("l'OCR reconnaît du texte français connu", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__TEST_API__ && window.__TEST_API__.recognizePage);

  const result = await page.evaluate(async () => {
    const lines = [
      'Bonjour le monde.',
      'Ceci est un veritable test de',
      'reconnaissance optique de caracteres',
      'sur plusieurs lignes de texte francais.',
    ];
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const c = canvas.getContext('2d');
    c.fillStyle = '#fff';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#000';
    c.font = '46px Georgia, "Times New Roman", serif';
    lines.forEach((l, i) => c.fillText(l, 40, 100 + i * 120));
    const srcUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Vraie chaîne : post-traitement puis OCR.
    const proc = await window.__TEST_API__.toHighContrast(srcUrl, { threshold: 0.5 });
    const data = await window.__TEST_API__.recognizePage(proc.dataUrl, 'fra', () => {});
    return { text: data.text, confidence: data.confidence };
  });

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();
  const expected = norm(
    'Bonjour le monde Ceci est un veritable test de reconnaissance optique de caracteres sur plusieurs lignes de texte francais'
  );
  const gotWords = new Set(norm(result.text).split(' '));
  const expWords = expected.split(' ');
  const hits = expWords.filter((w) => gotWords.has(w));
  const ratio = hits.length / expWords.length;

  // eslint-disable-next-line no-console
  console.log(`OCR: ${hits.length}/${expWords.length} mots, confiance ${Math.round(result.confidence)}%`);

  expect(ratio).toBeGreaterThan(0.7);
  expect(result.confidence).toBeGreaterThan(60);
});
