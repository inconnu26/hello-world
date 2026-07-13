// Capture d'une frame vidéo + post-traitement pour optimiser l'OCR.

const MAX_DIM = 1800; // borne la résolution pour la mémoire et la vitesse OCR

// Capture l'image courante d'un élément <video> et la renvoie en JPEG (couleur),
// redimensionnée pour ne pas dépasser MAX_DIM sur son plus grand côté.
export function captureFrame(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('Flux vidéo non prêt');

  const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: w,
    height: h,
  };
}

// Charge un dataURL en HTMLImageElement (promesse).
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = src;
  });
}

// Transforme une image en noir & blanc à fort contraste (binarisation),
// ce qui améliore nettement la reconnaissance de texte.
// - grayscale pondéré
// - étirement de contraste + seuillage adaptatif simple (par rapport à la moyenne)
export async function toHighContrast(dataUrl, { threshold = 0.5, invert = false } = {}) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 1) niveaux de gris + calcul de la luminance moyenne
  const gray = new Float32Array(data.length / 4);
  let sum = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[j] = g;
    sum += g;
  }
  const mean = sum / gray.length;

  // 2) seuil = mélange entre moyenne de l'image et réglage utilisateur
  const cut = mean * (0.6 + 0.8 * threshold); // threshold 0..1 -> décale le seuil

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    let v = gray[j] >= cut ? 255 : 0;
    if (invert) v = 255 - v;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width: canvas.width,
    height: canvas.height,
  };
}
