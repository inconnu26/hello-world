const { test, expect } = require('@playwright/test');

// Parcours complet (moteur LOCAL) : créer un livre -> capturer -> OCR local -> .txt
test('sessions → capture → OCR local → téléchargement', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Book Scanner OCR' })).toBeVisible();

  // Créer un livre
  await page.locator('.new-book input').fill('Mon livre test');
  await page.getByRole('button', { name: /Nouveau/ }).click();

  // Capture : aperçu temps réel
  await page.waitForSelector('video.preview');
  await page.waitForFunction(() => {
    const v = document.querySelector('video.preview');
    return v && v.videoWidth > 0 && !v.paused;
  }, null, { timeout: 10000 });

  // 2 photos manuelles
  for (let i = 0; i < 2; i++) {
    await page.locator('.manual-btn').click();
    await page.waitForTimeout(250);
  }
  await expect(page.locator('.shot-count')).toContainText('2');

  // Vers l'écran du livre
  await page.locator('.gallery-link').click();
  await expect(page.locator('.thumb')).toHaveCount(2);

  // Ouvrir la visionneuse et naviguer (boutons + fermeture)
  await page.locator('.thumb').first().click();
  await expect(page.locator('.viewer-overlay')).toBeVisible();
  await page.locator('.viewer-inner .nav.next').click();
  await expect(page.locator('.viewer-bar')).toContainText('Page 2 / 2');

  // Reprendre (remplacer) la photo courante : retour capture -> 1 photo -> retour livre
  await page.locator('.viewer-bar .mini', { hasText: 'Reprendre' }).click();
  await page.waitForFunction(() => {
    const v = document.querySelector('video.preview');
    return v && v.videoWidth > 0 && !v.paused;
  }, null, { timeout: 10000 });
  await expect(page.locator('.replace-banner')).toBeVisible();
  await page.locator('.manual-btn').click();
  await expect(page.locator('.thumb')).toHaveCount(2); // remplacée, pas ajoutée

  // Nouvel OCR (moteur local par défaut)
  await page.getByRole('button', { name: /Nouvel OCR/ }).click();
  await expect(page.locator('.engine-opt.sel')).toContainText('Tesseract');
  await page.getByRole('button', { name: /Lancer l'OCR/ }).click();

  // Attendre la fin (toutes pages done/erreur)
  await page.waitForFunction(() => {
    const chips = [...document.querySelectorAll('.pages-detail .chip')];
    return chips.length === 2 && chips.every((c) => c.classList.contains('done') || c.classList.contains('error'));
  }, null, { timeout: 180000 });
  expect(await page.locator('.pages-detail .chip.done').count()).toBeGreaterThanOrEqual(1);

  // Téléchargement .txt
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.run-buttons .secondary.small').click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.txt$/);

  // Retour au livre : le run est listé
  await page.getByRole('button', { name: /Mon livre test/ }).click();
  await expect(page.locator('.session .run-item')).toHaveCount(1);

  // Suppression du run OCR
  page.on('dialog', (d) => d.accept());
  await page.locator('.run-item .mini.danger').click();
  await expect(page.locator('.session .run-item')).toHaveCount(0);

  expect(consoleErrors, 'aucune erreur console').toEqual([]);
});
