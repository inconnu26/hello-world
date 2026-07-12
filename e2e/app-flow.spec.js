const { test, expect } = require('@playwright/test');

// Parcours complet de l'application avec une caméra factice (flux synthétique).
// Vérifie les fonctionnalités clés de bout en bout.
test('parcours complet : réglages → capture → galerie → OCR → PDF', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Book Scanner OCR' })).toBeVisible();

  // --- Réglage de la fréquence (+/-) ---
  const num = page.locator('.step-value .num');
  const before = Number(await num.textContent());
  await page.getByLabel('Augmenter').click();
  await expect(num).toHaveText(String(before + 1));
  await page.getByLabel('Diminuer').click();
  await page.getByLabel('Diminuer').click();
  await expect(num).toHaveText(String(before - 1));

  // --- Capture : aperçu vidéo temps réel ---
  await page.getByText('Démarrer le scan').click();
  await expect(page.locator('video.preview')).toBeVisible();
  await page.waitForFunction(() => {
    const v = document.querySelector('video.preview');
    return v && v.videoWidth > 0 && !v.paused;
  });

  // Trois captures manuelles
  for (let i = 0; i < 3; i++) {
    await page.locator('.manual-btn').click();
    await page.waitForTimeout(200);
  }
  await expect(page.locator('.shot-count')).toContainText('3');

  // --- Galerie ---
  await page.locator('.gallery-link').click();
  await expect(page.locator('.thumb')).toHaveCount(3);

  const tag = page.locator('.page-tag');
  await expect(tag).toContainText('Page 1 / 3');

  // Bouton suivant / précédent
  await page.locator('.nav.next').click();
  await expect(tag).toContainText('Page 2 / 3');
  await page.locator('.nav.prev').click();
  await expect(tag).toContainText('Page 1 / 3');

  // Swipe gauche = page suivante
  await page.evaluate(() => {
    const el = document.querySelector('.viewer');
    const mk = (type, x) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
      el.dispatchEvent(new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === 'touchend' ? [] : [t],
        changedTouches: [t],
      }));
    };
    mk('touchstart', 300);
    mk('touchend', 180);
  });
  await expect(tag).toContainText('Page 2 / 3');

  // Aperçu noir & blanc
  await page.getByRole('button', { name: /Aperçu N&B/ }).click();
  await expect(page.getByRole('button', { name: /Couleur/ })).toBeVisible();

  // --- OCR ---
  await page.locator(".bottom-bar .primary").click();
  await expect(page.locator('.overall')).toBeVisible();
  await page.locator('.run-buttons .primary').click();

  // La progression démarre (moteur en cours) puis toutes les pages se terminent.
  await expect(page.locator('.chip.running').first()).toBeVisible({ timeout: 60000 });
  await page.waitForFunction(() => {
    const chips = [...document.querySelectorAll('.chip')];
    return chips.length === 3 && chips.every((c) => c.classList.contains('done') || c.classList.contains('error'));
  }, null, { timeout: 180000 });

  const done = await page.locator('.chip.done').count();
  expect(done).toBe(3);

  // La barre globale a progressé
  const width = await page.locator('.bar-fill').evaluate((el) => parseFloat(el.style.width));
  expect(width).toBeGreaterThan(0);

  // Le journal détaillé contient des lignes
  expect(await page.locator('.log-line').count()).toBeGreaterThan(3);

  // --- Export PDF (déclenche un téléchargement) ---
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /PDF texte/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  expect(consoleErrors, 'aucune erreur console').toEqual([]);
});
