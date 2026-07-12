// Sons du compte à rebours et déclencheur.
// Utilise l'API Web Audio (bips) + optionnellement la synthèse vocale ("3, 2, 1").

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}

// Certains navigateurs mobiles suspendent l'AudioContext tant qu'il n'y a pas
// eu d'interaction utilisateur : à appeler au clic sur "Démarrer".
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  // Réveille aussi la synthèse vocale sur iOS.
  if ('speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* ignore */
    }
  }
}

function beep(frequency, duration, volume = 0.25) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// Bip de décompte (3, 2, 1)
export function tickSound() {
  beep(660, 0.12);
}

// Son de déclenchement "photo prise"
export function shutterSound() {
  beep(880, 0.08, 0.3);
  setTimeout(() => beep(1320, 0.14, 0.3), 90);
}

// Annonce vocale du chiffre en français (facultatif)
export function speakNumber(n, enabled) {
  if (!enabled) return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(n));
    u.lang = 'fr-FR';
    u.rate = 1.15;
    window.speechSynthesis.speak(u);
  } catch (e) {
    /* ignore */
  }
}
