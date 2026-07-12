// Rendu des cartes en pur DOM/CSS (aucune image).
// - Couleurs : coins indexés + grand symbole, figures avec glyphe illustré
// - Atouts : bandeaux numérotés haut/bas + pictogramme central (façon Tarot)
// - Excuse : carte violette au joker
// - Dos de carte : bleu à losanges

import { SUIT_SYMBOLS, HONOR_SHORT, isExcuse, isTrump, rankOf, suitOf } from '/shared/cards.js';

const GLYPHES = { 14: '♚', 13: '♛', 12: '♞', 11: '♟' };

// Un pictogramme par atout (1 à 21), façon « scène » des tarots illustrés.
const PICTOS = [
  '🎭', '🌱', '🍀', '🎣', '⚒', '🍇', '⛵', '🌾', '🐑', '🎪',
  '🦁', '🏹', '🔥', '⚖', '🐻', '🏰', '🌙', '⭐', '🌞', '🎺', '👑',
];

export function renderCard(id, { size = '', extraClass = '' } = {}) {
  const el = document.createElement('div');
  el.className = `carte ${size} ${extraClass}`.trim();
  el.dataset.carte = id;

  if (isExcuse(id)) {
    el.classList.add('c-EX');
    el.innerHTML = `
      <div class="coin haut">★</div>
      <div class="cadre-int"></div>
      <div class="centre"><span class="etoile">🃏</span><span class="libelle">EXCUSE</span></div>
      <div class="coin bas">★</div>`;
    return el;
  }
  if (isTrump(id)) {
    const n = rankOf(id);
    el.classList.add('c-A');
    el.innerHTML = `
      <div class="bande"><span>${n}</span><span class="orn">✦</span><span>${n}</span></div>
      <div class="illu"><span class="picto">${PICTOS[n - 1]}</span></div>
      <div class="bande inversee"><span>${n}</span><span class="orn">✦</span><span>${n}</span></div>`;
    return el;
  }
  const suit = suitOf(id);
  const r = rankOf(id);
  const sym = SUIT_SYMBOLS[suit];
  const label = HONOR_SHORT[r] ?? String(r);
  el.classList.add(`c-${suit}`);
  const centre =
    r > 10
      ? `<span class="figure">${GLYPHES[r]}</span><span class="sym">${sym}</span>`
      : `<span class="num">${r}</span><span class="sym">${sym}</span>`;
  el.innerHTML = `
    <div class="coin haut">${label}<span>${sym}</span></div>
    ${r > 10 ? '<div class="cadre-int"></div>' : ''}
    <div class="centre">${centre}</div>
    <div class="coin bas">${label}<span>${sym}</span></div>`;
  return el;
}

export function renderCardBack({ size = '', extraClass = '' } = {}) {
  const el = document.createElement('div');
  el.className = `carte dos ${size} ${extraClass}`.trim();
  el.innerHTML = '<span class="dos-logo">T</span>';
  return el;
}

export function renderCardRow(ids, opts = {}) {
  const row = document.createElement('div');
  row.className = 'rangee-cartes';
  for (const id of ids) row.appendChild(renderCard(id, opts));
  return row;
}
