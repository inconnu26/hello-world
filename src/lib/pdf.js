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
