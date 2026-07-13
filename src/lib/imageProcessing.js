// Capture d'une frame vidéo + post-traitement pour optimiser l'OCR.

const MAX_DIM = 1800; // borne la résolution pour la mémoire et la vitesse OCR

// Capture l'image courante d'un élément <video> et la renvoie en JPEG (couleur),
// redimensionnée pour ne pas dépasser MAX_DIM sur son plus grand côté.
// `rotate` (0, 90, -90/270, 180) redresse la photo — utile en mode paysage,
// quand le téléphone est tenu tourné à 90° : la photo est ré-orientée droite.
export function captureFrame(video, { rotate = 0 } = {}) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('Flux vidéo non prêt');

  const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  const rot = (((rotate % 360) + 360) % 360);

  const canvas = document.createElement('canvas');
  if (rot === 90 || rot === 270) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (rot === 90) {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rot === 180) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  } else if (rot === 270) {
    ctx.translate(0, w);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(video, 0, 0, w, h);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: canvas.width,
    height: canvas.height,
  };
}

// Rogne une zone de l'aperçu vidéo. `rect` est exprimé en pixels d'affichage
// (mêmes coordonnées que le conteneur `contW`×`contH`, qui affiche la vidéo en
// object-fit: cover). On mappe précisément cette zone vers les pixels réels de
// la vidéo, de sorte que « ce qui est sous les pointillés = ce qui est extrait ».
export function cropFrame(video, rect, contW, contH) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('Flux vidéo non prêt');
  if (!contW || !contH) throw new Error('Dimensions du conteneur inconnues');

  // object-fit: cover -> échelle = max, vidéo centrée, débordement rogné.
  const s = Math.max(contW / vw, contH / vh);
  const dispW = vw * s;
  const dispH = vh * s;
  const offX = (dispW - contW) / 2;
  const offY = (dispH - contH) / 2;

  let srcX = (rect.x + offX) / s;
  let srcY = (rect.y + offY) / s;
  let srcW = rect.w / s;
  let srcH = rect.h / s;

  // Clamp défensif dans les bornes de la vidéo.
  srcX = Math.max(0, Math.min(vw, srcX));
  srcY = Math.max(0, Math.min(vh, srcY));
  srcW = Math.max(1, Math.min(vw - srcX, srcW));
  srcH = Math.max(1, Math.min(vh - srcY, srcH));

  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: outW, height: outH };
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
