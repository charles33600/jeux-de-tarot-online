// IA heuristique des bots : évaluation de main pour les enchères, choix de
// l'appel, de l'écart et de la carte à jouer. Les bots ne trichent pas : ils
// ne connaissent que leur main, le pli en cours, les cartes déjà jouées et
// le partenaire s'il a été révélé.

import {
  EXCUSE,
  PETIT,
  VINGT_ET_UN,
  SUITS,
  isExcuse,
  isKing,
  isTrump,
  points,
  rankOf,
  suitOf,
} from '../shared/cards.js';
import { plainDiscardables } from '../shared/ecart.js';
import { trickWinner, ledSuitOf } from '../shared/play.js';
import { poigneeOptions } from '../shared/poignee.js';

const ATTACK = 0;
const DEFENSE = 1;

// ---------------------------------------------------------------- Enchères

export function evalHand(hand) {
  const trumps = hand.filter(isTrump);
  let score = 0;
  if (hand.includes(VINGT_ET_UN)) score += 10;
  if (hand.includes(EXCUSE)) score += 7;
  if (hand.includes(PETIT)) score += trumps.length >= 7 ? 9 : trumps.length >= 5 ? 6 : 2;
  score += trumps.length * 2;
  score += trumps.filter((c) => rankOf(c) >= 16).length * 1.5;
  for (const s of SUITS) {
    const len = hand.filter((c) => suitOf(c) === s).length;
    if (hand.includes(`${s}-14`)) score += 6;
    if (hand.includes(`${s}-13`)) score += 3;
    if (len === 0) score += 5; // coupe franche
    else if (len === 1) score += 3; // singleton
  }
  return score;
}

// Seuils par variante : les mains de 24 cartes (3 joueurs) donnent des scores
// bien plus élevés que celles de 15 cartes (5 joueurs).
const BID_THRESHOLDS = {
  3: [['gardeContre', 88], ['gardeSans', 74], ['garde', 58], ['petite', 44]],
  4: [['gardeContre', 80], ['gardeSans', 66], ['garde', 50], ['petite', 37]],
  5: [['gardeContre', 70], ['gardeSans', 56], ['garde', 42], ['petite', 31]],
};

export function chooseBid(hand, nbJoueurs, legal) {
  const score = evalHand(hand);
  for (const [contract, seuil] of BID_THRESHOLDS[nbJoueurs]) {
    if (score >= seuil && legal.includes(contract)) return contract;
  }
  return 'passe';
}

// ------------------------------------------------------------ Appel du roi

export function chooseCall(hand, callable) {
  const suitLen = (s) => hand.filter((c) => suitOf(c) === s && !isTrump(c)).length;
  const held = callable.filter((c) => hand.includes(c));
  if (held.length && evalHand(hand) >= 78) return held[0]; // très fort : joue seul
  const pool = callable.filter((c) => !hand.includes(c));
  const candidates = pool.length ? pool : callable;
  // Appeler dans sa couleur la plus longue : on pourra rejoindre le partenaire.
  return candidates.reduce((best, c) => (suitLen(suitOf(c)) > suitLen(suitOf(best)) ? c : best));
}

// ------------------------------------------------------------------- Écart

export function chooseEcart(hand, chienSize, calledCard) {
  const plain = plainDiscardables(hand, calledCard);
  const suitLen = (s) => hand.filter((c) => suitOf(c) === s && !isTrump(c)).length;
  const hasKing = (s) => hand.includes(`${s}-14`);
  const value = (c) => {
    const s = suitOf(c);
    // Mettre les points à l'abri (dames, cavaliers) et créer des coupes.
    return points(c) * 2 + (5 - suitLen(s)) * 1.5 - (hasKing(s) ? 1.5 : 0);
  };
  const chosen = [...plain].sort((a, b) => value(b) - value(a)).slice(0, chienSize);
  if (chosen.length < chienSize) {
    // Pas assez de cartes écartables : compléter avec les plus petits atouts.
    const trumps = hand
      .filter((c) => isTrump(c) && c !== PETIT && c !== VINGT_ET_UN)
      .sort((a, b) => rankOf(a) - rankOf(b));
    chosen.push(...trumps.slice(0, chienSize - chosen.length));
  }
  return chosen;
}

// ---------------------------------------------------------------- Poignée

export function choosePoignee(hand, nbJoueurs) {
  const opts = poigneeOptions(hand, nbJoueurs);
  if (!opts.length) return null;
  return opts[opts.length - 1].level; // déclare la plus grosse poignée possible
}

// ------------------------------------------------------------ Jeu de carte

function campOf(ctx, seat) {
  if (seat === ctx.takerSeat) return ATTACK;
  if (ctx.partnerSeat !== null && ctx.partnerSeat !== undefined && seat === ctx.partnerSeat) {
    return ATTACK;
  }
  if (seat === ctx.seat) return DEFENSE;
  // À 5 joueurs, tant que le partenaire n'est pas révélé, le camp des autres
  // joueurs est inconnu.
  if (ctx.nbJoueurs === 5 && (ctx.partnerSeat === null || ctx.partnerSeat === undefined)) {
    return null;
  }
  return DEFENSE;
}

function myCampWins(ctx, trick) {
  const real = trick.filter((t) => !isExcuse(t.card));
  if (!real.length) return null;
  const winnerSeat = trickWinner(trick).seat;
  const mine = campOf(ctx, ctx.seat);
  const theirs = campOf(ctx, winnerSeat);
  if (mine === null || theirs === null) return null;
  return mine === theirs;
}

// La carte gagnerait-elle le pli tel qu'il est ?
function beats(card, trick) {
  if (isExcuse(card)) return false;
  const winner = trickWinner([...trick, { seat: -1, card }]);
  return winner.card === card;
}

// Coût de la perte d'une carte (plus c'est bas, plus on peut la lâcher).
function cost(card) {
  if (card === PETIT) return 15; // ne jamais offrir le Petit
  if (isKing(card)) return 7;
  return points(card) + rankOf(card) * 0.02;
}

const cheapest = (cards) => cards.reduce((a, b) => (cost(a) <= cost(b) ? a : b));
const fattest = (cards) => cards.reduce((a, b) => (points(a) >= points(b) ? a : b));

function chooseLead(ctx, cards) {
  const { hand } = ctx;
  const trumps = cards.filter(isTrump);
  const plain = cards.filter((c) => !isTrump(c) && !isExcuse(c));
  const petitOut =
    !ctx.playedCards.includes(PETIT) && !hand.includes(PETIT) && ctx.trickNumber > 0;

  if (ctx.seat === ctx.takerSeat) {
    // Le preneur chasse le Petit avec ses gros atouts.
    const bigs = trumps.filter((c) => rankOf(c) >= 15 && c !== PETIT);
    if (bigs.length && petitOut && hand.filter(isTrump).length >= 4) {
      return bigs.reduce((a, b) => (rankOf(a) >= rankOf(b) ? a : b));
    }
    if (plain.length) return leadFromLongSuit(ctx, plain);
    if (trumps.length) return cheapest(trumps.filter((c) => c !== PETIT).length ? trumps.filter((c) => c !== PETIT) : trumps);
    return cards[0];
  }
  // Défense : entamer une couleur, jamais atout si possible.
  if (plain.length) return leadFromLongSuit(ctx, plain);
  if (trumps.length) {
    const safe = trumps.filter((c) => c !== PETIT);
    return cheapest(safe.length ? safe : trumps);
  }
  return cards[0];
}

function leadFromLongSuit(ctx, plain) {
  const bySuit = new Map();
  for (const c of plain) {
    const s = suitOf(c);
    if (!bySuit.has(s)) bySuit.set(s, []);
    bySuit.get(s).push(c);
  }
  let best = null;
  for (const cards of bySuit.values()) {
    if (!best || cards.length > best.length) best = cards;
  }
  // Le roi sec ou accompagné : l'entamer pour l'encaisser ; sinon petite carte.
  const king = best.find(isKing);
  if (king && !ctx.playedCards.some((c) => suitOf(c) === suitOf(king) && isTrump(c))) {
    return king;
  }
  return best.reduce((a, b) => (rankOf(a) <= rankOf(b) ? a : b));
}

export function chooseCard(ctx) {
  const { legal, trick } = ctx;
  if (legal.length === 1) return legal[0];
  const lastTrickOfDonne = ctx.trickNumber === ctx.tricksTotal - 1;
  const nonExcuse = legal.filter((c) => !isExcuse(c));

  // Jouer l'Excuse avant qu'il ne soit trop tard (elle serait capturée au dernier pli).
  if (
    legal.includes(EXCUSE) &&
    !lastTrickOfDonne &&
    ctx.trickNumber >= ctx.tricksTotal - 3 &&
    trick.length > 0
  ) {
    return EXCUSE;
  }
  if (!nonExcuse.length) return EXCUSE;

  const realTrick = trick.filter((t) => !isExcuse(t.card));
  if (!realTrick.length) return chooseLead(ctx, nonExcuse); // entame (ou après l'Excuse seule)

  const isLastToPlay = trick.length === ctx.nbJoueurs - 1;
  const campWinning = myCampWins(ctx, trick);
  const winners = nonExcuse.filter((c) => beats(c, trick));
  const trickPts = trick.reduce((s, t) => s + points(t.card), 0);

  if (campWinning === true) {
    if (isLastToPlay) {
      // Charger le pli du camp : donner un maximum de points sans risque.
      return fattest(nonExcuse);
    }
    // Le pli peut encore être pris : ne pas gaspiller, jouer petit.
    return cheapest(nonExcuse);
  }

  if (winners.length) {
    const w = cheapest(winners);
    // Prendre si le pli vaut des points, si on est dernier, ou si ça ne coûte presque rien.
    if (isLastToPlay || trickPts >= 2.5 || cost(w) <= 1.2) return w;
  }

  // On ne prend pas : sauver l'Excuse en la lâchant sur un pli perdu de milieu de partie.
  if (legal.includes(EXCUSE) && campWinning === false && ctx.trickNumber >= 2 && trickPts >= 2) {
    return EXCUSE;
  }
  return cheapest(nonExcuse);
}
