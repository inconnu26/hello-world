// Génération du PDF final avec jsPDF.
// Deux contenus possibles par page :
//  - le texte OCR (PDF sélectionnable / copiable)
//  - éventuellement l'image en dessous (pour vérifier)

import { jsPDF } from 'jspdf';

// Construit un PDF texte : une page PDF par photo, dans l'ordre.
// pages: [{ text, index }]
export function buildTextPdf(pages, { title = 'Livre scanné' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const marginY = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usableW = pageW - marginX * 2;
  const lineHeight = 15;

  pages.forEach((p, i) => {
    if (i > 0) doc.addPage();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Page ${i + 1}`, marginX, marginY - 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(20);

    const text = (p.text || '').trim() || '(Aucun texte reconnu sur cette page)';
    const lines = doc.splitTextToSize(text, usableW);

    let y = marginY;
    lines.forEach((line) => {
      if (y > pageH - marginY) {
        doc.addPage();
        y = marginY;
      }
      doc.text(line, marginX, y);
      y += lineHeight;
    });
  });

  return doc;
}

// Construit un PDF d'images (les photos traitées), une par page.
// pages: [{ dataUrl, width, height }]
export function buildImagePdf(pages) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 24;

  pages.forEach((p, i) => {
    if (i > 0) doc.addPage();
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = Math.min(maxW / p.width, maxH / p.height);
    const w = p.width * ratio;
    const h = p.height * ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    doc.addImage(p.dataUrl, 'JPEG', x, y, w, h);
  });

  return doc;
}

export function savePdf(doc, filename) {
  doc.save(filename);
}

// PDF « livre » soigné : une page PDF par page du livre, page de titre,
// en-tête (titre) et pied (numéro), texte JUSTIFIÉ, et surtout une TAILLE DE
// POLICE ADAPTÉE au contenu pour bien remplir la page (page courte = gros texte,
// page dense = plus petit mais lisible). Pages courtes centrées verticalement.
// pages: [{ text }].
const LH_RATIO = 1.42; // interligne
const FS_MIN = 9;
const FS_MAX = 22;

function paragraphsOf(text) {
  const t = (text || '').trim();
  if (!t) return ['(page vide)'];
  const paras = t.split(/\n{2,}/).map((s) => s.replace(/\n/g, ' ').trim()).filter(Boolean);
  return paras.length ? paras : ['(page vide)'];
}

// Hauteur totale du bloc de texte pour une taille de police donnée.
function blockHeight(doc, paragraphs, usableW, fs) {
  const lineH = fs * LH_RATIO;
  const paraGap = fs * 0.7;
  let h = 0;
  doc.setFontSize(fs);
  paragraphs.forEach((p) => { h += doc.splitTextToSize(p, usableW).length * lineH; });
  return h + paraGap * (paragraphs.length - 1);
}

// Plus grande police (FS_MIN..FS_MAX) pour laquelle le texte tient dans usableH.
function fitFontSize(doc, paragraphs, usableW, usableH) {
  doc.setFont('times', 'normal');
  for (let fs = FS_MAX; fs >= FS_MIN; fs -= 0.5) {
    if (blockHeight(doc, paragraphs, usableW, fs) <= usableH) return fs;
  }
  return FS_MIN;
}

export function buildBookPdf(pages, { title = 'Livre' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 68;
  const marginTop = 84;
  const marginBottom = 64;
  const usableW = pageW - marginX * 2;
  const usableH = pageH - marginTop - marginBottom;

  // Page de titre
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(20);
  doc.text(doc.splitTextToSize(title, usableW), pageW / 2, pageH / 2 - 16, { align: 'center' });
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(`${pages.length} page${pages.length > 1 ? 's' : ''}`, pageW / 2, pageH / 2 + 16, { align: 'center' });

  const chrome = (pageNum, fs, suite) => {
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(150);
    doc.text(title, marginX, 46, { maxWidth: usableW });
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(140);
    doc.text(`— ${pageNum}${suite ? ` · ${suite}` : ''} —`, pageW / 2, pageH - 38, { align: 'center' });
    // rétablit la police du corps
    doc.setFont('times', 'normal');
    doc.setFontSize(fs);
    doc.setTextColor(25);
  };

  pages.forEach((p, i) => {
    doc.addPage();
    const paragraphs = paragraphsOf(p.text);
    const fs = fitFontSize(doc, paragraphs, usableW, usableH);
    const lineH = fs * LH_RATIO;
    const paraGap = fs * 0.7;
    const bh = blockHeight(doc, paragraphs, usableW, fs);
    const paginated = bh > usableH;
    // Pages courtes : centrées verticalement ; pages pleines : haut de page.
    let y = paginated ? marginTop : marginTop + Math.max(0, (usableH - bh) / 2);
    let suite = 0;

    chrome(i + 1, fs, suite ? `suite ${suite}` : '');

    paragraphs.forEach((para) => {
      doc.setFont('times', 'normal');
      doc.setFontSize(fs);
      doc.setTextColor(25);
      const lines = doc.splitTextToSize(para, usableW);
      lines.forEach((line, idx) => {
        if (y > pageH - marginBottom) {
          doc.addPage();
          suite += 1;
          y = marginTop;
          chrome(i + 1, fs, `suite ${suite}`);
        }
        const isLastLineOfPara = idx === lines.length - 1;
        if (isLastLineOfPara) doc.text(line, marginX, y);
        else doc.text(line, marginX, y, { align: 'justify', maxWidth: usableW });
        y += lineH;
      });
      y += paraGap;
    });
  });

  return doc;
}

// PDF de debug : pour chaque page, une page PDF avec la PHOTO source, suivie
// d'une page PDF avec la TRANSCRIPTION homogénéisée. Permet de comparer d'où
// l'on part (image) et où l'on arrive (texte).
// items: [{ dataUrl, width, height, text }]
export function buildDebugPdf(items, { title = 'Debug', imageLabel = 'Photo source (OCR)' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableW = pageW - margin * 2;
  const lineHeight = 15;

  const heading = (label) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(label, margin, 34);
  };

  let first = true;
  items.forEach((it, i) => {
    // Page image
    if (!first) doc.addPage();
    first = false;
    heading(`Page ${i + 1} · ${imageLabel}`);
    if (it.dataUrl && it.width && it.height) {
      const maxW = usableW;
      const maxH = pageH - 70 - margin;
      const ratio = Math.min(maxW / it.width, maxH / it.height);
      const w = it.width * ratio;
      const h = it.height * ratio;
      doc.addImage(it.dataUrl, 'JPEG', (pageW - w) / 2, 60, w, h);
    }

    // Page texte
    doc.addPage();
    heading(`Page ${i + 1} · Transcription homogénéisée`);
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(25);
    const text = (it.text || '').trim() || '(vide)';
    const lines = doc.splitTextToSize(text.replace(/\n{2,}/g, '\n\n'), usableW);
    let y = 66;
    lines.forEach((line) => {
      if (y > pageH - margin) {
        doc.addPage();
        heading(`Page ${i + 1} · Transcription (suite)`);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(25);
        y = 66;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    });
  });

  return doc;
}

// Télécharge un texte brut en .txt
export function saveText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
