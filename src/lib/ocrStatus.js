// Traduction des étapes internes de Tesseract en libellés lisibles.
// Module isolé (sans dépendance à tesseract.js) pour être testable unitairement.

export const STATUS_LABELS = {
  'loading tesseract core': 'Chargement du moteur OCR',
  'loaded tesseract core': 'Moteur OCR chargé',
  'initializing tesseract': 'Initialisation du moteur',
  'initialized tesseract': 'Moteur initialisé',
  'loading language traineddata': 'Chargement des données de langue',
  'loaded language traineddata': 'Langue chargée',
  'initializing api': "Préparation de l'analyse",
  'initialized api': 'Analyse prête',
  'recognizing text': 'Reconnaissance du texte',
};

export function labelForStatus(status) {
  if (!status) return '';
  return STATUS_LABELS[status] || status;
}
