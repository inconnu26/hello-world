// Lance l'OCR d'une page selon le moteur choisi (local Tesseract ou OpenRouter).
import { toHighContrast } from './imageProcessing';
import { recognizePage } from './ocr';
import { transcribeImage } from './openrouter';

// opts: { engine, model, lang, apiKey, threshold }
// page: { originalDataUrl }
// Renvoie { text, confidence, processedDataUrl? }
export async function ocrPage(opts, page, onLog, signal) {
  if (opts.engine === 'openrouter') {
    // Les LLM vision lisent très bien la couleur : on envoie l'image d'origine.
    if (onLog) onLog({ status: 'envoi à OpenRouter', progress: 0.2 });
    const { text } = await transcribeImage({
      apiKey: opts.apiKey,
      model: opts.model,
      dataUrl: page.originalDataUrl,
      signal,
    });
    if (onLog) onLog({ status: 'réponse reçue', progress: 1 });
    return { text, confidence: null };
  }

  // Moteur local : binarisation puis Tesseract.
  if (onLog) onLog({ status: 'préparation image', progress: 0 });
  const proc = await toHighContrast(page.originalDataUrl, { threshold: opts.threshold });
  const data = await recognizePage(proc.dataUrl, opts.lang, onLog);
  return {
    text: (data.text || '').trim(),
    confidence: data.confidence,
    processedDataUrl: proc.dataUrl,
  };
}
