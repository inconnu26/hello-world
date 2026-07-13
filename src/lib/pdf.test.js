import { buildTextPdf, buildImagePdf } from './pdf';

// Un petit JPEG 1x1 valide en base64 (data URL).
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////' +
  '////////////////////////////////////////////////////////////////////////' +
  'wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const header = (doc) => {
  const buf = Buffer.from(doc.output('arraybuffer'));
  return buf.slice(0, 5).toString();
};

describe('buildTextPdf', () => {
  test('produit un PDF valide avec une page par photo', () => {
    const doc = buildTextPdf([{ text: 'Page une' }, { text: 'Page deux' }, { text: 'Page trois' }]);
    expect(header(doc)).toBe('%PDF-');
    expect(doc.getNumberOfPages()).toBe(3);
  });
  test('gère un texte vide sans planter', () => {
    const doc = buildTextPdf([{ text: '' }, { text: null }]);
    expect(header(doc)).toBe('%PDF-');
    expect(doc.getNumberOfPages()).toBe(2);
  });
  test('un texte très long déborde sur plusieurs pages PDF', () => {
    const long = 'mot '.repeat(4000);
    const doc = buildTextPdf([{ text: long }]);
    expect(header(doc)).toBe('%PDF-');
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});

describe('buildImagePdf', () => {
  test('produit un PDF valide avec les images', () => {
    const doc = buildImagePdf([
      { dataUrl: TINY_JPEG, width: 100, height: 150 },
      { dataUrl: TINY_JPEG, width: 100, height: 150 },
    ]);
    expect(header(doc)).toBe('%PDF-');
    expect(doc.getNumberOfPages()).toBe(2);
  });
});
