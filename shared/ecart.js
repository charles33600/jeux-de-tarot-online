import { isKing, isOudler, isTrump } from './cards.js';

// L'écart ne peut contenir ni roi, ni bout, ni la carte appelée (à 5 joueurs).
// Un atout n'est autorisé que si le preneur n'a pas assez d'autres cartes
// écartables ; tout atout écarté doit être montré aux autres joueurs.

export function forbiddenInEcart(card, calledCard) {
  return isKing(card) || isOudler(card) || card === calledCard;
}

// Cartes écartables sans contrainte (ni roi, ni bout, ni carte appelée, ni atout).
export function plainDiscardables(cards, calledCard) {
  return cards.filter((c) => !forbiddenInEcart(c, calledCard) && !isTrump(c));
}

export function validateEcart(cards, ecart, chienSize, calledCard = null) {
  if (!Array.isArray(ecart) || ecart.length !== chienSize) {
    return { ok: false, error: `L'écart doit contenir exactement ${chienSize} cartes.` };
  }
  if (new Set(ecart).size !== ecart.length) {
    return { ok: false, error: "L'écart contient des cartes en double." };
  }
  for (const c of ecart) {
    if (!cards.includes(c)) return { ok: false, error: 'Carte non possédée.' };
    if (isKing(c)) return { ok: false, error: "Impossible d'écarter un roi." };
    if (isOudler(c)) return { ok: false, error: "Impossible d'écarter un bout." };
    if (c === calledCard) return { ok: false, error: "Impossible d'écarter la carte appelée." };
  }
  const plain = plainDiscardables(cards, calledCard);
  const shownTrumps = ecart.filter(isTrump);
  const nonTrumpCount = ecart.length - shownTrumps.length;
  if (shownTrumps.length > 0 && nonTrumpCount < Math.min(plain.length, chienSize)) {
    return {
      ok: false,
      error: "Vous ne pouvez écarter un atout que si vous n'avez pas d'autre choix.",
    };
  }
  return { ok: true, shownTrumps };
}
