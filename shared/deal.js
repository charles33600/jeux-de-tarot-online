import { buildDeck } from './cards.js';
import { DEAL_CONFIG } from './constants.js';

// RNG seedable pour des tests et simulations reproductibles.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(cards, rng = Math.random) {
  const d = [...cards];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Distribution par paquets de 3 ; le chien est constitué carte par carte au fil
// de la donne, jamais avec la première ni la dernière carte distribuée.
export function deal(nbJoueurs, rng = Math.random) {
  const { hand: handSize, chien: chienSize } = DEAL_CONFIG[nbJoueurs];
  const deck = shuffle(buildDeck(), rng);
  const hands = Array.from({ length: nbJoueurs }, () => []);
  const chien = [];
  const totalPackets = (nbJoueurs * handSize) / 3;
  const chienAfterPacket = new Set();
  for (let k = 1; k <= chienSize; k++) {
    chienAfterPacket.add(Math.floor((k * (totalPackets - 1)) / (chienSize + 1)));
  }
  let idx = 0;
  let seat = 0;
  for (let p = 0; p < totalPackets; p++) {
    hands[seat].push(deck[idx++], deck[idx++], deck[idx++]);
    seat = (seat + 1) % nbJoueurs;
    if (chienAfterPacket.has(p)) chien.push(deck[idx++]);
  }
  return { hands, chien };
}
