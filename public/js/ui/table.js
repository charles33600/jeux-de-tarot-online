// Écran de jeu : plateau, sièges, pli en cours, main, enchères, écart,
// appel du roi, poignées, fin de donne.

import { emit } from '../net.js';
import { toast, modal, closeModal, bouton, el } from './dialogues.js';
import { renderCard, renderCardRow } from './cartes.js';
import { CONTRACT_NAMES, POIGNEE_NAMES, PHASES } from '/shared/constants.js';
import { cardName } from '/shared/cards.js';

const POSITIONS = { 3: ['b', 'l', 'r'], 4: ['b', 'l', 't', 'r'], 5: ['b', 'l', 'tl', 'tr', 'r'] };

const BID_LABELS = {
  passe: 'Passe',
  petite: 'Petite',
  garde: 'Garde',
  gardeSans: 'Garde sans',
  gardeContre: 'Garde contre',
};

export function renderTable(app, view, ui) {
  if (ui.donneKey !== view.donne) {
    ui.donneKey = view.donne;
    ui.ecartSel = new Set();
    ui.pendingPoignee = null;
    ui.pendingChelem = false;
    ui.poigneeRefusee = false;
    ui.resultFerme = false;
  }

  app.innerHTML = '';
  const page = el('div', 'jeu');
  page.appendChild(renderTopBar(view, ui));

  const plateau = el('div', 'plateau');
  renderSeats(plateau, view);
  renderCenter(plateau, view);
  renderLastTrick(plateau, view);
  page.appendChild(plateau);

  page.appendChild(renderBottom(view, ui));
  app.appendChild(page);

  if (ui.showScores) app.appendChild(renderScoresPanel(view, ui));

  if (view.phase === PHASES.FIN_DONNE && view.result && !ui.resultFerme) {
    showResultModal(view, ui);
  } else if (view.phase === PHASES.APPEL_ROI && view.actions?.type === 'appelRoi') {
    showAppelModal(view);
  } else {
    closeModal();
  }
}

// ------------------------------------------------------------------ Bandeau

function renderTopBar(view, ui) {
  const bar = el('div', 'bandeau');
  const gauche = el('div', 'bandeau-gauche');
  gauche.appendChild(el('span', 'chip chip-code', `Table ${view.code}`));
  gauche.appendChild(el('span', 'chip', `Donne ${view.donne}`));
  if (view.contract) {
    const taker = view.seats[view.takerSeat]?.name ?? '?';
    gauche.appendChild(el('span', 'chip chip-contrat', `${CONTRACT_NAMES[view.contract]} — ${taker}`));
  }
  if (view.calledCard) {
    gauche.appendChild(el('span', 'chip', `Appel : ${sansArticle(cardName(view.calledCard))}`));
  }
  if (view.chelemAnnounced) gauche.appendChild(el('span', 'chip chip-alerte', 'Chelem annoncé !'));
  if (view.phase === PHASES.JEU) {
    gauche.appendChild(el('span', 'chip', `Pli ${Math.min(view.trickNumber + 1, view.tricksTotal)}/${view.tricksTotal}`));
  }
  const droite = el('div', 'bandeau-droite');
  droite.appendChild(
    bouton('Scores', () => {
      ui.showScores = !ui.showScores;
      ui.rerender();
    }, 'btn-discret')
  );
  droite.appendChild(
    bouton('Quitter', async () => {
      if (!window.confirm('Quitter la table ? Un bot vous remplacera.')) return;
      await emit('table:quitter');
      localStorage.removeItem('tarot.token');
      window.location.reload();
    }, 'btn-discret')
  );
  bar.appendChild(gauche);
  bar.appendChild(droite);
  return bar;
}

// ------------------------------------------------------------------- Sièges

function renderSeats(plateau, view) {
  const n = view.nbJoueurs;
  for (let i = 0; i < n; i++) {
    const rel = (i - view.mySeat + n) % n;
    const pos = POSITIONS[n][rel];
    const s = view.seats[i];
    const plate = el('div', `siege pos-${pos}`);
    if (i === view.currentSeat) plate.classList.add('tour');
    if (!s.connected) plate.classList.add('deconnecte');

    const nom = el('div', 'siege-nom', s.name);
    if (i === view.mySeat) nom.textContent += ' (vous)';
    plate.appendChild(nom);

    const badges = el('div', 'siege-badges');
    if (i === view.dealerSeat) badges.appendChild(el('span', 'badge', 'Donneur'));
    if (i === view.takerSeat) badges.appendChild(el('span', 'badge badge-preneur', 'Preneur'));
    if (view.partnerSeat !== null && i === view.partnerSeat && i !== view.takerSeat) {
      badges.appendChild(el('span', 'badge badge-preneur', 'Partenaire'));
    }
    if (view.phase === PHASES.ENCHERES && view.bids[i]) {
      badges.appendChild(el('span', 'badge badge-enchere', BID_LABELS[view.bids[i]]));
    }
    if (s.humanBecameBot) badges.appendChild(el('span', 'badge', 'IA (absent)'));
    plate.appendChild(badges);

    if (i !== view.mySeat && view.handCounts) {
      plate.appendChild(el('div', 'siege-cartes', `🂠 ${view.handCounts[i]}`));
    }
    plateau.appendChild(plate);
  }
}

// ------------------------------------------------------------------- Centre

function renderCenter(plateau, view) {
  const n = view.nbJoueurs;

  if (view.phase === PHASES.ENCHERES) {
    const qui = view.currentSeat !== null ? view.seats[view.currentSeat].name : '';
    plateau.appendChild(el('div', 'message-centre', `Enchères — à ${qui} de parler…`));
    return;
  }
  if (view.phase === PHASES.ECART) {
    if (view.chien && view.mySeat !== view.takerSeat) {
      const zone = el('div', 'zone-chien');
      zone.appendChild(el('div', 'zone-titre', 'Le chien'));
      zone.appendChild(renderCardRow(view.chien, { size: 'moyenne' }));
      zone.appendChild(
        el('div', 'zone-sous-titre', `${view.seats[view.takerSeat].name} fait son écart…`)
      );
      plateau.appendChild(zone);
    }
    return;
  }
  if (view.phase === PHASES.JEU || view.phase === PHASES.FIN_DONNE) {
    for (const { seat, card } of view.trick) {
      const rel = (seat - view.mySeat + n) % n;
      const wrap = el('div', `pli-carte pli-${POSITIONS[n][rel]}`);
      wrap.appendChild(renderCard(card, { size: 'moyenne' }));
      wrap.appendChild(el('div', 'pli-nom', view.seats[seat].name));
      plateau.appendChild(wrap);
    }
  }
}

function renderLastTrick(plateau, view) {
  if (!view.lastTrick || view.phase !== PHASES.JEU) return;
  const box = el('div', 'dernier-pli');
  box.appendChild(
    el('div', 'zone-sous-titre', `Dernier pli — ${view.seats[view.lastTrick.winnerSeat].name}`)
  );
  box.appendChild(renderCardRow(view.lastTrick.cards.map((t) => t.card), { size: 'petite' }));
  plateau.appendChild(box);
}

// --------------------------------------------------- Bas d'écran : main etc.

function renderBottom(view, ui) {
  const zone = el('div', 'bas');

  const actions = view.actions;
  const barre = el('div', 'barre-actions');

  if (actions?.type === 'enchere') {
    barre.appendChild(el('span', 'invite', 'À vous de parler :'));
    for (const e of actions.encheres) {
      barre.appendChild(
        bouton(BID_LABELS[e], async () => {
          const r = await emit('jeu:action', { type: 'enchere', enchere: e });
          if (r.error) toast(r.error, { type: 'error' });
        }, e === 'passe' ? '' : 'btn-principal')
      );
    }
  } else if (actions?.type === 'ecart') {
    const sel = ui.ecartSel;
    barre.appendChild(el('span', 'invite', `Écart : ${sel.size}/${actions.nb} cartes choisies`));
    const valider = bouton('Valider l’écart', async () => {
      const r = await emit('jeu:action', { type: 'ecart', cartes: [...sel] });
      if (r.error) toast(r.error, { type: 'error' });
      else ui.ecartSel = new Set();
    }, 'btn-principal');
    valider.disabled = sel.size !== actions.nb;
    barre.appendChild(valider);
  } else if (actions?.type === 'carte') {
    barre.appendChild(el('span', 'invite', 'À vous de jouer !'));
    renderPoigneeBanner(barre, view, ui);
  } else if (view.phase === PHASES.FIN_DONNE) {
    barre.appendChild(
      bouton('Voir le résultat', () => {
        ui.resultFerme = false;
        ui.rerender();
      }, 'btn-discret')
    );
    if (actions?.type === 'donneSuivante') {
      barre.appendChild(
        bouton('Donne suivante', async () => {
          const r = await emit('jeu:action', { type: 'donneSuivante' });
          if (r.error) toast(r.error, { type: 'error' });
        }, 'btn-principal')
      );
    }
  } else if (view.currentSeat !== null && view.currentSeat !== view.mySeat) {
    barre.appendChild(el('span', 'invite invite-attente', `Au tour de ${view.seats[view.currentSeat].name}…`));
  }
  zone.appendChild(barre);

  // Atouts montrés à l'écart
  if (view.shownTrumps?.length) {
    const info = el('div', 'info-atouts');
    info.appendChild(el('span', '', 'Atouts écartés (montrés) : '));
    info.appendChild(renderCardRow(view.shownTrumps, { size: 'petite' }));
    zone.appendChild(info);
  }

  zone.appendChild(renderHand(view, ui));
  return zone;
}

function renderPoigneeBanner(barre, view, ui) {
  const actions = view.actions;
  if (ui.pendingPoignee !== null) {
    barre.appendChild(el('span', 'chip chip-contrat', `${POIGNEE_NAMES[ui.pendingPoignee]} annoncée avec cette carte`));
  }
  if (ui.pendingChelem) barre.appendChild(el('span', 'chip chip-alerte', 'Chelem annoncé avec cette carte'));
  if (!actions.poignees?.length || ui.poigneeRefusee || ui.pendingPoignee !== null) {
    if (actions.chelemPossible && !ui.pendingChelem && !ui.poigneeRefusee && !actions.poignees?.length) {
      // pas de poignée mais chelem possible : petit bouton discret
      barre.appendChild(
        bouton('Annoncer un chelem', () => {
          ui.pendingChelem = true;
          ui.rerender();
        }, 'btn-discret')
      );
    }
    return;
  }
  for (const o of actions.poignees) {
    barre.appendChild(
      bouton(`${o.nom} (+${o.bonus})`, () => {
        ui.pendingPoignee = o.level;
        ui.rerender();
      })
    );
  }
  if (actions.chelemPossible) {
    barre.appendChild(
      bouton('Annoncer un chelem', () => {
        ui.pendingChelem = true;
        ui.rerender();
      })
    );
  }
  barre.appendChild(
    bouton('Non merci', () => {
      ui.poigneeRefusee = true;
      ui.rerender();
    }, 'btn-discret')
  );
}

function renderHand(view, ui) {
  const main = el('div', 'main-joueur');
  const actions = view.actions;
  const jouables = new Set(actions?.type === 'carte' ? actions.cartes : []);
  const ecartables = new Set(actions?.type === 'ecart' ? actions.ecartables : []);

  for (const id of view.maMain) {
    let cls = '';
    if (actions?.type === 'carte') cls = jouables.has(id) ? 'jouable' : 'inerte';
    if (actions?.type === 'ecart') {
      cls = ecartables.has(id) ? 'jouable' : 'inerte';
      if (ui.ecartSel.has(id)) cls += ' choisie';
    }
    const c = renderCard(id, { extraClass: cls });
    if (actions?.type === 'carte' && jouables.has(id)) {
      c.addEventListener('click', async () => {
        const r = await emit('jeu:action', {
          type: 'carte',
          carte: id,
          poignee: ui.pendingPoignee,
          chelem: ui.pendingChelem,
        });
        if (r.error) toast(r.error, { type: 'error' });
        ui.pendingPoignee = null;
        ui.pendingChelem = false;
      });
    } else if (actions?.type === 'ecart' && ecartables.has(id)) {
      c.addEventListener('click', () => {
        if (ui.ecartSel.has(id)) ui.ecartSel.delete(id);
        else if (ui.ecartSel.size < actions.nb) ui.ecartSel.add(id);
        ui.rerender();
      });
    }
    main.appendChild(c);
  }
  return main;
}

// ------------------------------------------------------------------ Modales

function showAppelModal(view) {
  const box = el('div');
  box.appendChild(el('h2', '', 'Appelez votre partenaire'));
  box.appendChild(el('p', '', 'Choisissez la carte appelée. Son détenteur sera votre partenaire (secret). Appeler une carte que vous détenez : vous jouez seul.'));
  const row = el('div', 'rangee-cartes rangee-cliquable');
  for (const id of view.actions.cartes) {
    const c = renderCard(id, { size: 'moyenne', extraClass: 'jouable' });
    c.addEventListener('click', async () => {
      const r = await emit('jeu:action', { type: 'appelRoi', carte: id });
      if (r.error) toast(r.error, { type: 'error' });
    });
    row.appendChild(c);
  }
  box.appendChild(row);
  modal(box, { closable: false });
}

function showResultModal(view, ui) {
  const r = view.result;
  const box = el('div');
  const taker = view.seats[r.takerSeat]?.name ?? '?';
  box.appendChild(el('h2', '', `Donne ${view.donne} — ${CONTRACT_NAMES[r.contract]} ${r.made ? 'réussie ✅' : 'chutée ❌'}`));

  let attaque = `Preneur : ${taker}`;
  if (view.nbJoueurs === 5) {
    attaque +=
      r.partnerSeat !== null && r.partnerSeat !== r.takerSeat
        ? ` — partenaire : ${view.seats[r.partnerSeat].name}`
        : ' — seul contre tous';
  }
  box.appendChild(el('p', 'resultat-ligne', attaque));
  box.appendChild(
    el('p', 'resultat-ligne', `${r.pts} points réalisés avec ${r.oudlers} bout${r.oudlers > 1 ? 's' : ''} (il en fallait ${r.target}).`)
  );

  const detail = el('ul', 'resultat-detail');
  detail.appendChild(el('li', '', `Contrat : ${r.base > 0 ? '+' : ''}${r.base}`));
  if (r.pab) detail.appendChild(el('li', '', `Petit au bout : ${r.pab > 0 ? '+' : ''}${r.pab}`));
  if (r.poigneeBonus) detail.appendChild(el('li', '', `Poignée(s) : ${r.poigneeBonus > 0 ? '+' : ''}${r.poigneeBonus}`));
  if (r.chelemBonus) detail.appendChild(el('li', '', `Chelem : ${r.chelemBonus > 0 ? '+' : ''}${r.chelemBonus}`));
  detail.appendChild(el('li', 'resultat-total', `Total (par part) : ${r.total > 0 ? '+' : ''}${r.total}`));
  box.appendChild(detail);

  const table = el('table', 'tableau-scores');
  const head = el('tr');
  head.append(el('th', '', 'Joueur'), el('th', '', 'Donne'), el('th', '', 'Cumul'));
  table.appendChild(head);
  view.seats.forEach((s, i) => {
    const tr = el('tr', i === view.mySeat ? 'moi' : '');
    tr.append(
      el('td', '', s.name),
      el('td', '', `${r.deltas[i] > 0 ? '+' : ''}${r.deltas[i]}`),
      el('td', '', String(view.totals[i]))
    );
    table.appendChild(tr);
  });
  box.appendChild(table);

  const btns = el('div', 'modal-boutons');
  btns.appendChild(
    bouton('Voir la table', () => {
      ui.resultFerme = true;
      ui.rerender();
    }, 'btn-discret')
  );
  if (view.actions?.type === 'donneSuivante') {
    btns.appendChild(
      bouton('Donne suivante', async () => {
        const res = await emit('jeu:action', { type: 'donneSuivante' });
        if (res.error) toast(res.error, { type: 'error' });
      }, 'btn-principal')
    );
  } else {
    btns.appendChild(el('span', 'attente', 'En attente de la donne suivante…'));
  }
  box.appendChild(btns);
  modal(box, { closable: false });
}

function renderScoresPanel(view, ui) {
  const panel = el('div', 'panneau-scores');
  const head = el('div', 'panneau-scores-titre');
  head.appendChild(el('h3', '', 'Scores'));
  head.appendChild(
    bouton('✕', () => {
      ui.showScores = false;
      ui.rerender();
    }, 'btn-discret')
  );
  panel.appendChild(head);

  const totaux = el('table', 'tableau-scores');
  view.seats.forEach((s, i) => {
    const tr = el('tr', i === view.mySeat ? 'moi' : '');
    tr.append(el('td', '', s.name), el('td', '', String(view.totals[i])));
    totaux.appendChild(tr);
  });
  panel.appendChild(totaux);

  if (view.scoreboard?.length) {
    panel.appendChild(el('h4', '', 'Historique'));
    const hist = el('table', 'tableau-scores');
    const h = el('tr');
    h.append(el('th', '', '#'), el('th', '', 'Contrat'), el('th', '', 'Preneur'), el('th', '', '±'));
    hist.appendChild(h);
    for (const d of [...view.scoreboard].reverse()) {
      const tr = el('tr');
      tr.append(
        el('td', '', String(d.donne)),
        el('td', '', `${CONTRACT_NAMES[d.contract]} ${d.made ? '✓' : '✗'}`),
        el('td', '', view.seats[d.takerSeat]?.name ?? '?'),
        el('td', '', `${d.total > 0 ? '+' : ''}${d.total}`)
      );
      hist.appendChild(tr);
    }
    panel.appendChild(hist);
  }
  return panel;
}

function sansArticle(nom) {
  return nom.replace(/^l[ae] /, '').replace(/^l'/, '');
}
