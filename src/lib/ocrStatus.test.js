import { labelForStatus, STATUS_LABELS } from './ocrStatus';

describe('labelForStatus', () => {
  test('traduit les étapes connues en français', () => {
    expect(labelForStatus('recognizing text')).toBe('Reconnaissance du texte');
    expect(labelForStatus('loading language traineddata')).toBe('Chargement des données de langue');
    expect(labelForStatus('initializing api')).toBe("Préparation de l'analyse");
  });
  test('retourne le statut brut si inconnu', () => {
    expect(labelForStatus('something new')).toBe('something new');
  });
  test('gère une valeur vide', () => {
    expect(labelForStatus('')).toBe('');
    expect(labelForStatus(undefined)).toBe('');
  });
  test('toutes les entrées connues ont une traduction non vide', () => {
    Object.values(STATUS_LABELS).forEach((v) => expect(v.length).toBeGreaterThan(0));
  });
});
