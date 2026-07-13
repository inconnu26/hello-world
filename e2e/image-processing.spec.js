const { test, expect } = require('@playwright/test');

// Vérifie le post-traitement noir & blanc (toHighContrast) dans un vrai navigateur,
// en appelant la vraie fonction du bundle exposée via ?e2e.
test('le post-traitement produit une image binarisée (noir & blanc)', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => window.__TEST_API__ && window.__TEST_API__.toHighContrast);

  const stats = await page.evaluate(async () => {
    // Image source : page réaliste — texte noir sur fond clair légèrement
    // dégradé (éclairage inégal). Le seuillage adaptatif doit garder le fond
    // blanc et ne noircir que le texte.
    const src = document.createElement('canvas');
    src.width = 500;
    src.height = 300;
    const sc = src.getContext('2d');
    // fond clair avec un léger dégradé (simule un éclairage inégal)
    for (let x = 0; x < 500; x++) {
      const v = Math.round(210 + (x / 499) * 40); // 210..250, jamais blanc pur
      sc.fillStyle = `rgb(${v},${v},${v})`;
      sc.fillRect(x, 0, 1, 300);
    }
    sc.fillStyle = '#111';
    sc.font = 'bold 34px Georgia, serif';
    for (let i = 0; i < 6; i++) sc.fillText('Texte de la page ' + (i + 1), 24, 50 + i * 44);
    const srcUrl = src.toDataURL('image/jpeg', 0.95);

    const res = await window.__TEST_API__.toHighContrast(srcUrl, { threshold: 0.5 });

    // Recharge le résultat et échantillonne les pixels.
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = res.dataUrl;
    });
    const out = document.createElement('canvas');
    out.width = img.naturalWidth;
    out.height = img.naturalHeight;
    const oc = out.getContext('2d');
    oc.drawImage(img, 0, 0);
    const data = oc.getImageData(0, 0, out.width, out.height).data;

    let dark = 0;
    let light = 0;
    let midtone = 0;
    let colored = 0;
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Math.abs(r - g) > 20 || Math.abs(g - b) > 20) colored++;
      const lum = (r + g + b) / 3;
      if (lum < 40) dark++;
      else if (lum > 215) light++;
      else midtone++;
    }
    return { total, dark, light, midtone, colored };
  });

  // Quasiment tous les pixels sont soit noirs soit blancs (binarisation réussie).
  const binarizedRatio = (stats.dark + stats.light) / stats.total;
  expect(binarizedRatio).toBeGreaterThan(0.95);
  // Le fond clair dégradé reste blanc en très grande majorité (pas noirci à tort).
  expect(stats.light / stats.total).toBeGreaterThan(0.7);
  // Le texte est bien présent en noir (petite fraction, mais non nulle).
  expect(stats.dark / stats.total).toBeGreaterThan(0.01);
  expect(stats.dark / stats.total).toBeLessThan(0.35);
  // Résultat en niveaux de gris (pas de couleur résiduelle).
  expect(stats.colored / stats.total).toBeLessThan(0.02);
});
