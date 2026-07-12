import { EXCUSE, isExcuse, isTrump, rankOf, suitOf } from './cards.js';

// trick : tableau de { seat, card } dans l'ordre où les cartes ont été jouées.

// Couleur demandée : celle de la première carte qui n'est pas l'Excuse.
// (Si l'Excuse entame, la deuxième carte fixe la couleur.)
export function ledSuitOf(trick) {
  for (const { card } of trick) if (!isExcuse(card)) return suitOf(card);
  return null;
}

// Coups légaux. ctx : { firstTrick, isTaker, calledCard } pour la contrainte
// d'entame du preneur à 5 joueurs (ne pas entamer de la couleur appelée au
// premier pli, sauf de la carte appelée elle-même).
export function legalMoves(hand, trick, ctx = {}) {
  const withExcuse = (cards) =>
    hand.includes(EXCUSE) && !cards.includes(EXCUSE) ? [...cards, EXCUSE] : cards;

  if (trick.length === 0) {
    if (ctx.firstTrick && ctx.isTaker && ctx.calledCard) {
      const calledSuit = suitOf(ctx.calledCard);
      const allowed = hand.filter(
        (c) => isExcuse(c) || isTrump(c) || suitOf(c) !== calledSuit || c === ctx.calledCard
      );
      if (allowed.length) return allowed;
    }
    return [...hand];
  }

  const led = ledSuitOf(trick);
  if (led === null) return [...hand]; // seule l'Excuse a été jouée : entame libre

  const trumpsInTrick = trick.filter((t) => isTrump(t.card));
  const highestTrump = trumpsInTrick.length
    ? Math.max(...trumpsInTrick.map((t) => rankOf(t.card)))
    : 0;
  const myTrumps = hand.filter(isTrump);
  const higherTrumps = myTrumps.filter((c) => rankOf(c) > highestTrump);

  if (led === 'A') {
    if (myTrumps.length) return withExcuse(higherTrumps.length ? higherTrumps : myTrumps);
    return [...hand]; // pas d'atout : défausse libre
  }

  const followers = hand.filter((c) => suitOf(c) === led);
  if (followers.length) return withExcuse(followers);
  // Défaussé de la couleur : obligation de couper, et de monter si possible.
  if (myTrumps.length) return withExcuse(higherTrumps.length ? higherTrumps : myTrumps);
  return [...hand];
}

// Vainqueur du pli (l'Excuse ne gagne jamais — le cas du chelem est géré
// par l'orchestrateur). Retourne l'entrée { seat, card } gagnante.
export function trickWinner(trick) {
  const real = trick.filter((t) => !isExcuse(t.card));
  const led = ledSuitOf(trick);
  const trumps = real.filter((t) => isTrump(t.card));
  const pool = trumps.length ? trumps : real.filter((t) => suitOf(t.card) === led);
  return pool.reduce((best, t) => (rankOf(t.card) > rankOf(best.card) ? t : best));
}
