// Constantes officielles (règlement FFT) par variante 3 / 4 / 5 joueurs.

export const DEAL_CONFIG = {
  3: { hand: 24, chien: 6 },
  4: { hand: 18, chien: 6 },
  5: { hand: 15, chien: 3 },
};

export const CONTRACTS = ['petite', 'garde', 'gardeSans', 'gardeContre'];

export const CONTRACT_MULT = { petite: 1, garde: 2, gardeSans: 4, gardeContre: 6 };

export const CONTRACT_NAMES = {
  petite: 'Petite',
  garde: 'Garde',
  gardeSans: 'Garde sans le chien',
  gardeContre: 'Garde contre le chien',
};

// Points à réaliser par l'attaque selon son nombre de bouts en fin de donne.
export const TARGETS = { 0: 56, 1: 51, 2: 41, 3: 36 };

// Seuils simple / double / triple poignée (nombre d'atouts) par nombre de joueurs.
export const POIGNEE_SEUILS = { 3: [13, 15, 18], 4: [10, 13, 15], 5: [8, 10, 13] };
export const POIGNEE_BONUS = [20, 30, 40];
export const POIGNEE_NAMES = ['Simple poignée', 'Double poignée', 'Triple poignée'];

export const CHELEM_BONUS = { annonceReussi: 400, nonAnnonce: 200, annonceRate: -200 };

export const PHASES = {
  ENCHERES: 'ENCHERES',
  APPEL_ROI: 'APPEL_ROI',
  ECART: 'ECART',
  JEU: 'JEU',
  FIN_DONNE: 'FIN_DONNE',
};
