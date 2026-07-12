import { SUITS } from './cards.js';

// À 5 joueurs : le preneur appelle un roi (une dame s'il a les 4 rois,
// un cavalier s'il a les 4 rois et les 4 dames). Il peut appeler une carte
// qu'il détient : il joue alors seul, sans que personne ne le sache.
export function callableCards(hand) {
  const holdsAll = (rank) => SUITS.every((s) => hand.includes(`${s}-${rank}`));
  let rank = 14;
  if (holdsAll(14)) rank = 13;
  if (rank === 13 && holdsAll(13)) rank = 12;
  return SUITS.map((s) => `${s}-${rank}`);
}
