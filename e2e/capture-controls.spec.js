const { test, expect } = require('@playwright/test');

test('capture : cropping 1/2 cadres, aperçu N&B (OK/Annuler), pause', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__TEST_API__ && window.__TEST_API__.cropFrame);

  await page.locator('.new-book input').fill('Crop test');
  await page.getByRole('button', { name: /Nouveau/ }).click();
  await page.waitForFunction(() => {
    const v = document.querySelector('video.preview');
    return v && v.videoWidth > 0 && !v.paused;
  }, null, { timeout: 10000 });

  // Mode "une page" par défaut : un seul cadre
  await expect(page.locator('.guide')).toHaveCount(1);

  // cropFrame respecte le ratio du rectangle demandé
  const ratio = await page.evaluate(() => {
    const v = document.querySelector('video.preview');
    const r = { x: 40, y: 60, w: 120, h: 170 };
    const c = window.__TEST_API__.cropFrame(v, r, v.clientWidth, v.clientHeight);
    return { got: c.width / c.height, want: r.w / r.h, url: c.dataUrl.slice(0, 11) };
  });
  expect(ratio.url).toBe('data:image/');
  expect(Math.abs(ratio.got - ratio.want)).toBeLessThan(0.06);

  // Annuler : la photo prise est retirée
  await page.locator('.manual-btn').click();
  await expect(page.locator('.review')).toBeVisible();
  await expect(page.locator('.review-imgs img')).toHaveCount(1);
  await page.locator('.review-cancel').click();
  await expect(page.locator('.shot-count')).toContainText('0');

  // Mode "livre ouvert" : deux cadres, une capture => deux pages
  await page.getByRole('button', { name: /Livre ouvert/ }).click();
  await expect(page.locator('.guide')).toHaveCount(2);

  // Les cadres tiennent dans la zone d'aperçu (ne dépassent pas sous les contrôles)
  const area = await page.locator('.preview-area').boundingBox();
  for (const g of await page.locator('.guide').all()) {
    const b = await g.boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(area.y - 1);
    expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height + 1);
    expect(b.x + b.width).toBeLessThanOrEqual(area.x + area.width + 1);
  }
  await page.locator('.manual-btn').click();
  await expect(page.locator('.review-imgs img')).toHaveCount(2);
  await page.locator('.review-ok').click();
  await page.locator('.gallery-link').click();
  await expect(page.locator('.thumb')).toHaveCount(2);

  // Pause / reprise
  await page.getByRole('button', { name: /Photos/ }).click();
  await page.waitForFunction(() => {
    const v = document.querySelector('video.preview');
    return v && v.videoWidth > 0 && !v.paused;
  }, null, { timeout: 10000 });
  await page.locator('.shoot').click();
  await expect(page.locator('.status-pill')).toContainText('Rafale');
  await page.locator('.pause-btn').click();
  await expect(page.locator('.status-pill')).toContainText('Pause');
  await page.locator('.pause-btn').click();
  await expect(page.locator('.status-pill')).toContainText('Rafale');
  await page.locator('.shoot').click();
  await expect(page.locator('.status-pill')).toContainText('Prêt');
});
