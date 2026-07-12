// Codec des cartes du Tarot français (78 cartes).
// Format des ids : "P-5" (5 de Pique), "C-14" (Roi de Cœur), "A-21" (21 d'atout), "EX" (Excuse).
// Couleurs : P = Pique, C = Cœur, K = Carreau, T = Trèfle, A = atout.

export const SUITS = ['P', 'C', 'K', 'T'];
export const EXCUSE = 'EX';
export const PETIT = 'A-1';
export const VINGT_ET_UN = 'A-21';

export const SUIT_SYMBOLS = { P: '♠', C: '♥', K: '♦', T: '♣' };
export const SUIT_NAMES = { P: 'Pique', C: 'Cœur', K: 'Carreau', T: 'Trèfle' };
export const HONOR_NAMES = { 11: 'Valet', 12: 'Cavalier', 13: 'Dame', 14: 'Roi' };
export const HONOR_SHORT = { 11: 'V', 12: 'C', 13: 'D', 14: 'R' };

export function buildDeck() {
  const deck = [];
  for (const s of SUITS) for (let r = 1; r <= 14; r++) deck.push(`${s}-${r}`);
  for (let n = 1; n <= 21; n++) deck.push(`A-${n}`);
  deck.push(EXCUSE);
  return deck;
}

export const isExcuse = (c) => c === EXCUSE;
export const isTrump = (c) => typeof c === 'string' && c.startsWith('A-');
export const suitOf = (c) => (isExcuse(c) ? null : c.split('-')[0]);
export const rankOf = (c) => (isExcuse(c) ? 0 : Number(c.split('-')[1]));
export const isOudler = (c) => c === PETIT || c === VINGT_ET_UN || c === EXCUSE;
export const isKing = (c) => !isExcuse(c) && !isTrump(c) && rankOf(c) === 14;

export function points(c) {
  if (isOudler(c)) return 4.5;
  if (isTrump(c)) return 0.5;
  const r = rankOf(c);
  if (r === 14) return 4.5;
  if (r === 13) return 3.5;
  if (r === 12) return 2.5;
  if (r === 11) return 1.5;
  return 0.5;
}

export function cardName(c) {
  if (isExcuse(c)) return "l'Excuse";
  if (isTrump(c)) return `le ${rankOf(c)} d'atout`;
  const r = rankOf(c);
  const label = HONOR_NAMES[r] || String(r);
  const suit = SUIT_NAMES[suitOf(c)];
  const article = r === 14 || r === 11 || r === 12 ? 'le ' : r === 13 ? 'la ' : 'le ';
  return `${article}${label} de ${suit}`;
}

const SUIT_ORDER = { P: 0, C: 1, T: 2, K: 3, A: 4 };

export function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (isExcuse(a)) return 1;
    if (isExcuse(b)) return -1;
    const sa = SUIT_ORDER[suitOf(a)];
    const sb = SUIT_ORDER[suitOf(b)];
    return sa !== sb ? sa - sb : rankOf(a) - rankOf(b);
  });
}
