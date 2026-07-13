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

// Binarise une image en noir & blanc par SEUILLAGE ADAPTATIF LOCAL (Bradley) :
// chaque pixel est comparé à la moyenne de son voisinage (via une image
// intégrale, rapide). Seules les lettres, localement plus sombres que le papier
// autour, deviennent noires ; les zones claires restent blanches, même en cas
// d'éclairage inégal. Bien plus fidèle qu'un seuil global (qui noircissait à
// tort des zones blanches).
// `threshold` (0..1) règle l'intensité du noir : plus haut = plus de noir.
export async function toHighContrast(dataUrl, { threshold = 0.5, invert = false } = {}) {
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  const N = W * H;

  // Niveaux de gris
  const gray = new Float64Array(N);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Image intégrale (somme cumulée) pour des moyennes de fenêtre en O(1).
  const IW = W + 1;
  const integral = new Float64Array(IW * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += gray[y * W + x];
      integral[(y + 1) * IW + (x + 1)] = integral[y * IW + (x + 1)] + rowSum;
    }
  }

  // Fenêtre locale ~ 1/16 de la largeur ; marge k = écart requis sous la
  // moyenne locale pour être considéré comme du texte (noir).
  const half = Math.max(8, Math.floor(W / 16));
  const k = Math.max(0.02, Math.min(0.5, 0.32 - threshold * 0.3)); // défaut 0.5 -> 0.17

  for (let y = 0; y < H; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(H - 1, y + half);
    for (let x = 0; x < W; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(W - 1, x + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * IW + (x2 + 1)] -
        integral[y1 * IW + (x2 + 1)] -
        integral[(y2 + 1) * IW + x1] +
        integral[y1 * IW + x1];
      const idx = y * W + x;
      const isBlack = gray[idx] * count <= sum * (1 - k);
      let v = isBlack ? 0 : 255;
      if (invert) v = 255 - v;
      const p = idx * 4;
      data[p] = data[p + 1] = data[p + 2] = v;
      data[p + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: W, height: H };
}
