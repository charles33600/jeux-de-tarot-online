import { EXCUSE, isTrump, rankOf } from './cards.js';
import { POIGNEE_BONUS, POIGNEE_NAMES, POIGNEE_SEUILS } from './constants.js';

// Poignées déclarables avec une main donnée. L'Excuse ne peut être montrée
// que si le joueur n'a pas assez d'atouts pour atteindre le seuil sans elle
// (la montrer certifie qu'il ne reste aucun atout caché).
export function poigneeOptions(hand, nbJoueurs) {
  const trumps = hand.filter(isTrump).sort((a, b) => rankOf(a) - rankOf(b));
  const hasExcuse = hand.includes(EXCUSE);
  const options = [];
  POIGNEE_SEUILS[nbJoueurs].forEach((seuil, level) => {
    if (trumps.length >= seuil) {
      options.push({
        level,
        seuil,
        bonus: POIGNEE_BONUS[level],
        nom: POIGNEE_NAMES[level],
        cards: trumps.slice(0, seuil),
      });
    } else if (hasExcuse && trumps.length + 1 === seuil) {
      options.push({
        level,
        seuil,
        bonus: POIGNEE_BONUS[level],
        nom: POIGNEE_NAMES[level],
        cards: [...trumps, EXCUSE],
      });
    }
  });
  return options;
}
