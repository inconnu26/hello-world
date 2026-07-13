const { test, expect } = require('@playwright/test');

// Flux CLOUD via OpenRouter, avec l'API mockée (aucune vraie clé requise).
// Couvre : validation de clé, OCR par modèle cloud, homogénéisation, export PDF.
test('OpenRouter (mock) : clé → OCR cloud → homogénéisation → PDF', async ({ page, context }) => {
  // Mock des endpoints OpenRouter
  await context.route('**/openrouter.ai/api/v1/key', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { label: 'Clé de test', usage: 0, limit: 5 } }) })
  );
  await context.route('**/openrouter.ai/api/v1/chat/completions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: 'Contenu simulé et corrigé de la page.' } }] }),
    })
  );

  await page.goto('/');

  // Réglages : saisir et vérifier la clé
  await page.locator('.gear').first().click();
  await page.locator('.key-row input').fill('sk-or-v1-fausse-cle-de-test');
  await page.getByRole('button', { name: /Vérifier/ }).click();
  await expect(page.locator('.key-status.ok')).toBeVisible();
  await page.getByRole('button', { name: /Retour/ }).click();

  // Créer un livre + 1 photo
  await page.locator('.new-book input').fill('Livre cloud');
  await page.getByRole('button', { name: /Nouveau/ }).click();
  await page.waitForFunction(() => {
    const v = document.querySelector('video.preview');
    return v && v.videoWidth > 0 && !v.paused;
  }, null, { timeout: 10000 });
  await page.locator('.manual-btn').click();
  await page.waitForTimeout(200);
  await page.locator('.gallery-link').click();

  // Nouvel OCR → moteur cloud
  await page.getByRole('button', { name: /Nouvel OCR/ }).click();
  await page.locator('.engine-opt', { hasText: 'Modèle cloud' }).click();
  await expect(page.locator('.engine-opt.sel')).toContainText('cloud');
  await page.getByRole('button', { name: /Lancer l'OCR/ }).click();

  // La page passe "done" avec le texte mocké
  await page.waitForFunction(() => {
    const chips = [...document.querySelectorAll('.pages-detail .chip')];
    return chips.length >= 1 && chips.every((c) => c.classList.contains('done') || c.classList.contains('error'));
  }, null, { timeout: 30000 });
  await expect(page.locator('.pages-detail .chip.done').first()).toBeVisible();
  await expect(page.locator('.row-text').first()).toContainText('simulé');

  // Retour au livre → Homogénéiser
  await page.getByRole('button', { name: /Livre cloud/ }).click();
  await page.getByRole('button', { name: /Homogénéiser/ }).click();
  await page.getByRole('button', { name: /Corriger/ }).click();
  await page.waitForFunction(() => {
    const chips = [...document.querySelectorAll('.pages-detail .chip')];
    return chips.length >= 1 && chips.every((c) => c.classList.contains('done') || c.classList.contains('error'));
  }, null, { timeout: 30000 });

  // Export PDF
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Exporter le PDF/ }).click(),
  ]);
  expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
});
