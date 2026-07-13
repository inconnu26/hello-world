const { test, expect } = require('@playwright/test');

test('capture : pause/reprise + mode paysage (rotation photo)', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__TEST_API__ && window.__TEST_API__.captureFrame);

  // Créer un livre et arriver sur la capture
  await page.locator('.new-book input').fill('Livre orientation');
  await page.getByRole('button', { name: /Nouveau/ }).click();
  await page.waitForFunction(() => {
    const v = document.querySelector('video.preview');
    return v && v.videoWidth > 0 && !v.paused;
  }, null, { timeout: 10000 });

  // --- Mode paysage : l'UI pivote et la photo est redressée (dimensions inversées) ---
  await page.getByRole('button', { name: 'Paysage' }).click();
  await expect(page.locator('.capture.landscape')).toBeVisible();
  const uiTransform = await page.locator('.ui-layer').evaluate((el) => getComputedStyle(el).transform);
  expect(uiTransform).not.toBe('none');

  const dims = await page.evaluate(() => {
    const v = document.querySelector('video.preview');
    const a = window.__TEST_API__.captureFrame(v, { rotate: 0 });
    const b = window.__TEST_API__.captureFrame(v, { rotate: 90 });
    return { aw: a.width, ah: a.height, bw: b.width, bh: b.height };
  });
  expect(dims.bw).toBe(dims.ah); // largeur pivotée = hauteur d'origine
  expect(dims.bh).toBe(dims.aw);

  // Retour portrait pour tester les contrôles
  await page.getByRole('button', { name: 'Portrait' }).click();

  // --- Pause / reprise ---
  await page.locator('.shoot').click(); // start
  await expect(page.locator('.status-pill')).toContainText('Rafale');
  await page.locator('.pause-btn').click(); // pause
  await expect(page.locator('.status-pill')).toContainText('Pause');
  await expect(page.locator('.paused-tag')).toBeVisible();
  await page.locator('.pause-btn').click(); // reprise
  await expect(page.locator('.status-pill')).toContainText('Rafale');
  await page.locator('.shoot').click(); // stop
  await expect(page.locator('.status-pill')).toContainText('Prêt');
});
