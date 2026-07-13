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

// PDF « livre » soigné, une page PDF par page du livre, avec page de titre,
// en-tête léger et numéro de page en pied. pages: [{ text }].
export function buildBookPdf(pages, { title = 'Livre' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 64;
  const marginTop = 72;
  const marginBottom = 64;
  const usableW = pageW - marginX * 2;
  const lineHeight = 16;
  const paraGap = 8;

  // Page de titre
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(20);
  const titleLines = doc.splitTextToSize(title, usableW);
  doc.text(titleLines, pageW / 2, pageH / 2 - 20, { align: 'center' });
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(`${pages.length} page${pages.length > 1 ? 's' : ''}`, pageW / 2, pageH / 2 + 12, { align: 'center' });

  pages.forEach((p, i) => {
    doc.addPage();

    // En-tête
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(title, marginX, 40, { maxWidth: usableW });

    // Corps
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(25);

    const text = (p.text || '').trim() || '(page vide)';
    const paragraphs = text.split(/\n{2,}/);
    let y = marginTop;

    const footer = (pdfPageOfBookPage) => {
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text(`Page ${i + 1}${pdfPageOfBookPage > 1 ? ` (suite ${pdfPageOfBookPage})` : ''}`, pageW / 2, pageH - 36, {
        align: 'center',
      });
    };

    let contPage = 1;
    footer(contPage);

    paragraphs.forEach((para) => {
      const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), usableW);
      lines.forEach((line) => {
        if (y > pageH - marginBottom) {
          doc.addPage();
          contPage += 1;
          doc.setFont('times', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(150);
          doc.text(title, marginX, 40, { maxWidth: usableW });
          doc.setFont('times', 'normal');
          doc.setFontSize(12);
          doc.setTextColor(25);
          y = marginTop;
          footer(contPage);
        }
        doc.text(line, marginX, y);
        y += lineHeight;
      });
      y += paraGap;
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
