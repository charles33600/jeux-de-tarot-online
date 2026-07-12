import { isOudler, points as cardPoints } from './cards.js';
import { CHELEM_BONUS, CONTRACT_MULT, POIGNEE_BONUS, TARGETS } from './constants.js';

export function countPoints(cards) {
  return cards.reduce((s, c) => s + cardPoints(c), 0);
}

export function countOudlers(cards) {
  return cards.filter(isOudler).length;
}

// Calcule le résultat d'une donne.
// - attackCards : toutes les cartes du camp de l'attaque (plis + écart/chien selon contrat)
// - petitAuBout : 'attack' | 'defense' | null (camp ayant gagné le dernier pli avec le Petit)
// - poignees : [{ seat, level }]
// - chelem : { announced, attackWonAll, defenseWonAll }
// Retourne le détail + les deltas de score par siège (somme nulle).
export function scoreDonne({
  nbJoueurs,
  contract,
  attackCards,
  takerSeat,
  partnerSeat = null,
  petitAuBout = null,
  poignees = [],
  chelem = {},
}) {
  const oudlers = countOudlers(attackCards);
  const target = TARGETS[oudlers];
  const pts = countPoints(attackCards);
  const diff = pts - target;
  const made = diff >= 0;
  const sign = made ? 1 : -1;
  const mult = CONTRACT_MULT[contract];

  const base = (25 + Math.ceil(Math.abs(diff))) * sign * mult;
  const pabSign = petitAuBout === 'attack' ? 1 : petitAuBout === 'defense' ? -1 : 0;
  const pab = pabSign * 10 * mult;
  // Les poignées reviennent toujours au camp vainqueur de la donne.
  const poigneeBonus = sign * poignees.reduce((s, p) => s + POIGNEE_BONUS[p.level], 0);

  let chelemBonus = 0;
  if (chelem.attackWonAll) {
    chelemBonus = chelem.announced ? CHELEM_BONUS.annonceReussi : CHELEM_BONUS.nonAnnonce;
  } else if (chelem.announced) {
    chelemBonus = CHELEM_BONUS.annonceRate;
  } else if (chelem.defenseWonAll) {
    chelemBonus = -CHELEM_BONUS.nonAnnonce;
  }

  // Total du point de vue du preneur (par part).
  const total = base + pab + poigneeBonus + chelemBonus;

  const deltas = new Array(nbJoueurs).fill(0);
  const alone = partnerSeat === null || partnerSeat === takerSeat;
  for (let s = 0; s < nbJoueurs; s++) {
    if (s === takerSeat) continue;
    if (!alone && s === partnerSeat) continue;
    deltas[s] = -total;
  }
  if (!alone) {
    // 5 joueurs avec partenaire : preneur 2 parts, partenaire 1 part, 3 défenseurs.
    deltas[takerSeat] = 2 * total;
    deltas[partnerSeat] = total;
  } else {
    deltas[takerSeat] = (nbJoueurs - 1) * total;
  }

  return {
    oudlers,
    target,
    pts,
    diff,
    made,
    mult,
    base,
    petitAuBout,
    pab,
    poigneeBonus,
    chelemBonus,
    total,
    deltas,
  };
}
