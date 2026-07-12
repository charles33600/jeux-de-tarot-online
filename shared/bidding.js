import { CONTRACTS } from './constants.js';

// Enchères légales : passer, ou surenchérir sur la meilleure enchère en cours.
export function legalBids(bestBid) {
  const start = bestBid ? CONTRACTS.indexOf(bestBid) + 1 : 0;
  return ['passe', ...CONTRACTS.slice(start)];
}
