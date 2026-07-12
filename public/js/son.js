// Bruitages synthétisés avec la Web Audio API : aucun fichier audio.
// Le contexte audio n'est créé qu'après le premier geste de l'utilisateur
// (exigence des navigateurs).

let ctx = null;
let muet = localStorage.getItem('tarot.muet') === '1';

function ac() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

document.addEventListener(
  'pointerdown',
  () => {
    if (!muet) ac();
  },
  { once: true }
);

function tone(freq, { delay = 0, dur = 0.15, type = 'sine', vol = 0.14, glide = null } = {}) {
  if (muet) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Souffle filtré (frottement de cartes).
function bruit({ delay = 0, dur = 0.12, vol = 0.12, freq = 1800, q = 0.8 } = {}) {
  if (muet) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const len = Math.max(1, Math.ceil(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(t);
}

export const sons = {
  get muet() {
    return muet;
  },
  toggleMuet() {
    muet = !muet;
    localStorage.setItem('tarot.muet', muet ? '1' : '0');
    if (!muet) ac();
  },
  // Carte posée : claquement sec.
  carte() {
    bruit({ dur: 0.06, vol: 0.3, freq: 2600, q: 0.6 });
    tone(190, { dur: 0.06, type: 'triangle', vol: 0.1 });
  },
  // C'est à vous : carillon doux.
  tour() {
    tone(660, { dur: 0.12, vol: 0.12 });
    tone(990, { delay: 0.11, dur: 0.18, vol: 0.12 });
  },
  // Pli ramassé : glissement.
  pli() {
    bruit({ dur: 0.28, vol: 0.16, freq: 900, q: 0.5 });
  },
  // Distribution : riffle de cartes.
  distribution() {
    for (let i = 0; i < 7; i++) bruit({ delay: i * 0.05, dur: 0.045, vol: 0.14, freq: 2300 });
  },
  // Annonce (preneur, appel, partenaire) : double note.
  annonce() {
    tone(520, { dur: 0.09, type: 'square', vol: 0.05 });
    tone(700, { delay: 0.09, dur: 0.12, type: 'square', vol: 0.05 });
  },
  // Poignée / chelem : fanfare montante.
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, { delay: i * 0.09, dur: 0.22, vol: 0.11 }));
  },
  // Fin de donne.
  victoire() {
    [523, 659, 784].forEach((f, i) => tone(f, { delay: i * 0.14, dur: 0.32, vol: 0.13 }));
  },
  defaite() {
    [392, 311, 233].forEach((f, i) => tone(f, { delay: i * 0.16, dur: 0.34, type: 'sawtooth', vol: 0.06 }));
  },
};
