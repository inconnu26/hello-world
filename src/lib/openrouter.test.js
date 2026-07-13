import { splitByPageMarkers } from './openrouter';

describe('splitByPageMarkers', () => {
  test('re-découpe une réponse LLM par marqueurs de page', () => {
    const text = '<<<PAGE 1>>>\nBonjour le monde.\n\n<<<PAGE 2>>>\nDeuxième page.\n\n<<<PAGE 3>>>\nTroisième.';
    const map = splitByPageMarkers(text);
    expect(map[1]).toBe('Bonjour le monde.');
    expect(map[2]).toBe('Deuxième page.');
    expect(map[3]).toBe('Troisième.');
  });
  test('tolère les espaces et numéros non contigus', () => {
    const text = '<<< PAGE 5 >>>\nCinq\n<<<PAGE 6>>>\nSix';
    const map = splitByPageMarkers(text);
    expect(map[5]).toBe('Cinq');
    expect(map[6]).toBe('Six');
  });
  test('renvoie un objet vide sans marqueur', () => {
    expect(Object.keys(splitByPageMarkers('texte sans marqueur'))).toHaveLength(0);
  });
});
