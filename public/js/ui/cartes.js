// Rendu d'une carte en pur DOM/CSS (aucune image).

import { SUIT_SYMBOLS, HONOR_SHORT, isExcuse, isTrump, rankOf, suitOf } from '/shared/cards.js';

export function renderCard(id, { size = '', extraClass = '' } = {}) {
  const el = document.createElement('div');
  el.className = `carte ${size} ${extraClass}`.trim();
  el.dataset.carte = id;

  if (isExcuse(id)) {
    el.classList.add('c-EX');
    el.innerHTML = `
      <div class="coin haut">★</div>
      <div class="centre"><span class="etoile">★</span><span class="libelle">EXCUSE</span></div>
      <div class="coin bas">★</div>`;
    return el;
  }
  if (isTrump(id)) {
    const n = rankOf(id);
    el.classList.add('c-A');
    el.innerHTML = `
      <div class="coin haut">${n}</div>
      <div class="centre"><span class="atout-num">${n}</span><span class="libelle">ATOUT</span></div>
      <div class="coin bas">${n}</div>`;
    return el;
  }
  const suit = suitOf(id);
  const r = rankOf(id);
  const sym = SUIT_SYMBOLS[suit];
  const label = HONOR_SHORT[r] ?? String(r);
  el.classList.add(`c-${suit}`);
  const centre =
    r > 10
      ? `<span class="honneur">${label}</span><span class="sym">${sym}</span>`
      : `<span class="num">${r}</span><span class="sym">${sym}</span>`;
  el.innerHTML = `
    <div class="coin haut">${label}<span>${sym}</span></div>
    <div class="centre">${centre}</div>
    <div class="coin bas">${label}<span>${sym}</span></div>`;
  return el;
}

export function renderCardRow(ids, opts = {}) {
  const row = document.createElement('div');
  row.className = 'rangee-cartes';
  for (const id of ids) row.appendChild(renderCard(id, opts));
  return row;
}
