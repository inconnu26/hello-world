import {
  newSession,
  renameSession,
  addPages,
  removePage,
  movePage,
  replacePage,
  newRun,
  addRun,
  updateRun,
  updateRunPage,
  removeRun,
  runProgress,
  runToText,
  newHomogenization,
  addHomogenization,
  updateHomogenizationPage,
  removeHomogenization,
} from './sessionModel';

const seedSession = () => {
  let s = newSession({ name: 'Test', now: 1000 });
  s = addPages(s, [{ originalDataUrl: 'a' }, { originalDataUrl: 'b' }, { originalDataUrl: 'c' }], 1001);
  return s;
};

describe('session + pages', () => {
  test('crée une session vide cohérente', () => {
    const s = newSession({ name: 'Livre', now: 5 });
    expect(s.name).toBe('Livre');
    expect(s.pages).toEqual([]);
    expect(s.runs).toEqual([]);
    expect(s.homogenizations).toEqual([]);
  });
  test('renameSession change le nom, ignore un nom vide', () => {
    let s = newSession({ name: 'Ancien', now: 1 });
    s = renameSession(s, 'Nouveau');
    expect(s.name).toBe('Nouveau');
    s = renameSession(s, '');
    expect(s.name).toBe('Nouveau');
  });
  test('ajoute des pages avec identifiants uniques', () => {
    const s = seedSession();
    expect(s.pages).toHaveLength(3);
    const ids = new Set(s.pages.map((p) => p.id));
    expect(ids.size).toBe(3);
  });
  test('supprime et déplace des pages', () => {
    let s = seedSession();
    const mid = s.pages[1].id;
    s = removePage(s, mid);
    expect(s.pages.map((p) => p.originalDataUrl)).toEqual(['a', 'c']);
    s = movePage(s, s.pages[1].id, -1);
    expect(s.pages.map((p) => p.originalDataUrl)).toEqual(['c', 'a']);
  });
  test('movePage respecte les bornes', () => {
    const s = seedSession();
    expect(movePage(s, s.pages[0].id, -1)).toBe(s);
    expect(movePage(s, s.pages[2].id, 1)).toBe(s);
  });
  test('replacePage remplace l\'image en gardant id et position', () => {
    let s = seedSession();
    const id = s.pages[1].id;
    s = replacePage(s, id, { originalDataUrl: 'NEW', width: 9, height: 9 });
    expect(s.pages[1].id).toBe(id); // même id/position
    expect(s.pages[1].originalDataUrl).toBe('NEW');
    expect(s.pages.map((p) => p.originalDataUrl)).toEqual(['a', 'NEW', 'c']);
  });
});

describe('runs OCR', () => {
  test('newRun initialise une page par photo', () => {
    const s = seedSession();
    const run = newRun(s, { engine: 'tesseract-local', lang: 'fra' }, 2000);
    expect(run.pages).toHaveLength(3);
    expect(run.pages.every((p) => p.status === 'pending')).toBe(true);
    expect(run.engine).toBe('tesseract-local');
  });
  test('addRun / updateRunPage / progress / text', () => {
    let s = seedSession();
    const run = newRun(s, { engine: 'openrouter', model: 'x/y' }, 2000);
    s = addRun(s, run);
    expect(s.runs).toHaveLength(1);
    s = updateRunPage(s, run.id, 0, { status: 'done', text: 'Bonjour' });
    s = updateRunPage(s, run.id, 1, { status: 'done', text: 'Monde' });
    const r = s.runs[0];
    expect(runProgress(r)).toBeCloseTo(2 / 3);
    const txt = runToText(s, r);
    expect(txt).toContain('Page 1');
    expect(txt).toContain('Bonjour');
    expect(txt).toContain('Monde');
  });
  test('updateRun modifie le statut', () => {
    let s = seedSession();
    const run = newRun(s, { engine: 'tesseract-local', lang: 'eng' });
    s = addRun(s, run);
    s = updateRun(s, run.id, { status: 'done' });
    expect(s.runs[0].status).toBe('done');
  });
  test('removeRun retire aussi les homogénéisations liées', () => {
    let s = seedSession();
    const run = newRun(s, { engine: 'tesseract-local', lang: 'fra' });
    s = addRun(s, run);
    const hom = newHomogenization({ sourceRunId: run.id, model: 'm' }, 3);
    s = addHomogenization(s, hom);
    expect(s.homogenizations).toHaveLength(1);
    s = removeRun(s, run.id);
    expect(s.runs).toHaveLength(0);
    expect(s.homogenizations).toHaveLength(0);
  });
});

describe('homogénéisation', () => {
  test('newHomogenization crée une page par page source', () => {
    const hom = newHomogenization({ sourceRunId: 'r1', model: 'gpt' }, 4);
    expect(hom.pages).toHaveLength(4);
    expect(hom.sourceRunId).toBe('r1');
  });
  test('updateHomogenizationPage cible la bonne page', () => {
    let s = seedSession();
    const run = newRun(s, { engine: 'tesseract-local', lang: 'fra' });
    s = addRun(s, run);
    const hom = newHomogenization({ sourceRunId: run.id, model: 'm' }, 3);
    s = addHomogenization(s, hom);
    s = updateHomogenizationPage(s, hom.id, 2, { status: 'done', text: 'ok' });
    expect(s.homogenizations[0].pages[2].text).toBe('ok');
    expect(s.homogenizations[0].pages[0].status).toBe('pending');
  });
  test('removeHomogenization retire uniquement la bonne', () => {
    let s = seedSession();
    const run = newRun(s, { engine: 'tesseract-local', lang: 'fra' });
    s = addRun(s, run);
    const h1 = newHomogenization({ sourceRunId: run.id, model: 'a' }, 3);
    const h2 = newHomogenization({ sourceRunId: run.id, model: 'b' }, 3);
    s = addHomogenization(addHomogenization(s, h1), h2);
    expect(s.homogenizations).toHaveLength(2);
    s = removeHomogenization(s, h1.id);
    expect(s.homogenizations).toHaveLength(1);
    expect(s.homogenizations[0].id).toBe(h2.id);
  });
});
