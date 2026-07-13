import {
  DEFAULT_SETTINGS,
  clampInterval,
  newPage,
  addPage,
  updatePage,
  removePage,
  movePage,
  loadSettings,
} from './session';

describe('clampInterval', () => {
  test('reste dans les bornes 2..10', () => {
    expect(clampInterval(1)).toBe(2);
    expect(clampInterval(2)).toBe(2);
    expect(clampInterval(5)).toBe(5);
    expect(clampInterval(10)).toBe(10);
    expect(clampInterval(11)).toBe(10);
  });
  test('gère les valeurs invalides', () => {
    expect(clampInterval(NaN)).toBe(DEFAULT_SETTINGS.intervalSec);
  });
});

describe('newPage', () => {
  test('crée un état OCR initial propre', () => {
    const p = newPage({ originalDataUrl: 'x', width: 10, height: 20 });
    expect(p.id).toBeTruthy();
    expect(p.originalDataUrl).toBe('x');
    expect(p.width).toBe(10);
    expect(p.ocr).toEqual({
      status: 'pending',
      progress: 0,
      statusText: '',
      text: '',
      confidence: null,
      error: null,
    });
  });
  test('génère des identifiants uniques', () => {
    const a = newPage({});
    const b = newPage({});
    expect(a.id).not.toBe(b.id);
  });
});

describe('addPage / removePage', () => {
  test('ajoute puis retire une page', () => {
    let list = [];
    list = addPage(list, { originalDataUrl: 'a' });
    list = addPage(list, { originalDataUrl: 'b' });
    expect(list).toHaveLength(2);
    const id = list[0].id;
    list = removePage(list, id);
    expect(list).toHaveLength(1);
    expect(list.find((p) => p.id === id)).toBeUndefined();
  });
});

describe('updatePage', () => {
  test('fusionne finement le sous-objet ocr', () => {
    let list = addPage([], { originalDataUrl: 'a' });
    const id = list[0].id;
    list = updatePage(list, id, { ocr: { status: 'running', progress: 0.5 } });
    expect(list[0].ocr.status).toBe('running');
    expect(list[0].ocr.progress).toBe(0.5);
    // les autres champs ocr sont préservés
    expect(list[0].ocr.text).toBe('');
    list = updatePage(list, id, { ocr: { text: 'bonjour', progress: 1, status: 'done' } });
    expect(list[0].ocr.text).toBe('bonjour');
    expect(list[0].ocr.status).toBe('done');
  });
  test('peut patcher des champs de haut niveau (image traitée)', () => {
    let list = addPage([], { originalDataUrl: 'a' });
    const id = list[0].id;
    list = updatePage(list, id, { processedDataUrl: 'proc' });
    expect(list[0].processedDataUrl).toBe('proc');
    expect(list[0].ocr.status).toBe('pending');
  });
  test('ne touche pas aux autres pages', () => {
    let list = addPage(addPage([], { originalDataUrl: 'a' }), { originalDataUrl: 'b' });
    const target = list[1].id;
    const before = list[0];
    list = updatePage(list, target, { ocr: { status: 'done' } });
    expect(list[0]).toBe(before);
  });
});

describe('movePage', () => {
  const build = () => {
    let list = [];
    ['a', 'b', 'c'].forEach((x) => (list = addPage(list, { originalDataUrl: x })));
    return list;
  };
  test('déplace vers la droite', () => {
    const list = build();
    const moved = movePage(list, list[0].id, 1);
    expect(moved.map((p) => p.originalDataUrl)).toEqual(['b', 'a', 'c']);
  });
  test('déplace vers la gauche', () => {
    const list = build();
    const moved = movePage(list, list[2].id, -1);
    expect(moved.map((p) => p.originalDataUrl)).toEqual(['a', 'c', 'b']);
  });
  test('ne dépasse pas les bornes', () => {
    const list = build();
    expect(movePage(list, list[0].id, -1)).toEqual(list);
    expect(movePage(list, list[2].id, 1)).toEqual(list);
  });
  test('id inconnu = liste inchangée', () => {
    const list = build();
    expect(movePage(list, 'zzz', 1)).toBe(list);
  });
});

describe('loadSettings', () => {
  const fakeStorage = (value) => ({ getItem: () => value });
  test('retourne les valeurs par défaut sans stockage', () => {
    expect(loadSettings(fakeStorage(null))).toEqual(DEFAULT_SETTINGS);
  });
  test('fusionne les réglages sauvegardés', () => {
    const s = loadSettings(fakeStorage(JSON.stringify({ intervalSec: 7, lang: 'eng' })));
    expect(s.intervalSec).toBe(7);
    expect(s.lang).toBe('eng');
    expect(s.sound).toBe(DEFAULT_SETTINGS.sound);
  });
  test('résiste à un JSON corrompu', () => {
    expect(loadSettings(fakeStorage('{not json'))).toEqual(DEFAULT_SETTINGS);
  });
});
