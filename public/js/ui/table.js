// Écran de jeu : table ovale, avatars encadrés, bulles d'annonce, pli au
// centre, panneau « Contrat », écart, appel du roi, poignées, fin de donne.

import { emit } from '../net.js';
import { toast, modal, closeModal, bouton, el } from './dialogues.js';
import { renderCard, renderCardBack, renderCardRow } from './cartes.js';
import { renderAvatar } from './avatars.js';
import { sons } from '../son.js';
import { CONTRACTS, CONTRACT_MULT, CONTRACT_NAMES, POIGNEE_NAMES, PHASES } from '/shared/constants.js';
import { cardName } from '/shared/cards.js';

const POSITIONS = { 3: ['b', 'l', 'r'], 4: ['b', 'l', 't', 'r'], 5: ['b', 'l', 'tl', 'tr', 'r'] };

// Couleur de cadre par siège (stable pour tous les joueurs).
export const FRAME_COLORS = ['#4a90e2', '#e2574c', '#f08a24', '#9b59b6', '#f1c40f'];

const BID_LABELS = {
  passe: 'Passe',
  petite: 'Petite',
  garde: 'Garde',
  gardeSans: 'Garde sans',
  gardeContre: 'Garde contre',
};

const BULLE_DUREE = 5200;

export function renderTable(app, view, ui) {
  if (ui.donneKey !== view.donne) {
    ui.donneKey = view.donne;
    ui.ecartSel = new Set();
    ui.pendingPoignee = null;
    ui.pendingChelem = false;
    ui.poigneeRefusee = false;
    ui.resultFerme = false;
    ui.bubbles = {};
  }
  ui.bubbles = ui.bubbles || {};

  app.innerHTML = '';
  const page = el('div', 'jeu');
  page.appendChild(renderTopBar(view));
  page.appendChild(renderColonne(view, ui));

  const plateau = el('div', 'plateau');
  plateau.appendChild(el('div', 'table-ovale'));
  renderSeats(plateau, view, ui);
  renderCenter(plateau, view, ui);
  renderLastTrick(plateau, view);
  page.appendChild(plateau);

  page.appendChild(renderBottom(view, ui));
  app.appendChild(page);

  if (ui.showScores) app.appendChild(renderScoresPanel(view, ui));

  if (view.phase === PHASES.FIN_DONNE && view.result && !ui.resultFerme) {
    // Ne pas recréer la modale à chaque re-rendu (son animation rejouerait).
    if (!document.getElementById('modal') || ui.resultActions !== !!view.actions) {
      ui.resultActions = !!view.actions;
      showResultModal(view, ui);
    }
  } else {
    closeModal();
  }
}

// ------------------------------------------------------------------ Bandeau

function renderTopBar(view) {
  const bar = el('div', 'bandeau');
  bar.appendChild(el('span', 'chip chip-code', `Table ${view.code}`));
  bar.appendChild(el('span', 'chip', `Donne ${view.donne}`));
  if (view.contract) {
    const taker = view.seats[view.takerSeat]?.name ?? '?';
    bar.appendChild(el('span', 'chip chip-contrat', `${CONTRACT_NAMES[view.contract]} — ${taker}`));
  }
  if (view.calledCard) {
    bar.appendChild(el('span', 'chip', `Appel : ${sansArticle(cardName(view.calledCard))}`));
  }
  if (view.chelemAnnounced) bar.appendChild(el('span', 'chip chip-alerte', 'Chelem annoncé !'));
  if (view.phase === PHASES.JEU) {
    bar.appendChild(el('span', 'chip', `Pli ${Math.min(view.trickNumber + 1, view.tricksTotal)}/${view.tricksTotal}`));
  }
  return bar;
}

function renderColonne(view, ui) {
  const col = el('div', 'colonne-gauche');
  const quitter = bouton('⏻', async () => {
    if (!window.confirm('Quitter la table ? Un bot vous remplacera.')) return;
    await emit('table:quitter');
    localStorage.removeItem('tarot.token');
    window.location.reload();
  }, 'btn-carre btn-rouge');
  quitter.title = 'Quitter la table';
  col.appendChild(quitter);

  const son = bouton(sons.muet ? '🔇' : '🔊', () => {
    sons.toggleMuet();
    ui.rerender();
  }, 'btn-carre btn-bleu-carre');
  son.title = 'Sons';
  col.appendChild(son);

  const scores = bouton('🏆', () => {
    ui.showScores = !ui.showScores;
    ui.rerender();
  }, 'btn-carre btn-violet-carre');
  scores.title = 'Scores';
  col.appendChild(scores);
  return col;
}

// ------------------------------------------------------------------- Sièges

function renderSeats(plateau, view, ui) {
  const n = view.nbJoueurs;
  for (let i = 0; i < n; i++) {
    const rel = (i - view.mySeat + n) % n;
    const pos = POSITIONS[n][rel];
    const s = view.seats[i];
    const plate = el('div', `siege pos-${pos}`);
    plate.dataset.seat = i;
    if (i === view.currentSeat) plate.classList.add('tour');
    if (!s.connected) plate.classList.add('deconnecte');

    // Cadre coloré avec avatar + nom incrusté.
    const cadre = el('div', 'cadre');
    cadre.style.borderColor = FRAME_COLORS[i % FRAME_COLORS.length];
    cadre.appendChild(renderAvatar(s.name, s.isBot));
    const nomTxt = i === view.mySeat ? `${s.name} ✦` : s.name;
    cadre.appendChild(el('div', 'siege-nom', nomTxt));
    if (i === view.dealerSeat) cadre.appendChild(el('div', 'jeton-donneur', 'D'));
    if (i === view.takerSeat) cadre.appendChild(el('div', 'jeton-preneur', 'P'));
    if (view.partnerSeat !== null && i === view.partnerSeat && i !== view.takerSeat) {
      cadre.appendChild(el('div', 'jeton-preneur jeton-partenaire', 'P'));
    }
    plate.appendChild(cadre);

    // Score cumulé sous l'avatar (façon jetons).
    const score = el('div', 'score-chip');
    score.appendChild(el('span', 'score-ico', '🪙'));
    score.appendChild(el('span', '', String(view.totals?.[i] ?? 0)));
    plate.appendChild(score);

    // Éventail de dos de cartes pour les adversaires.
    if (i !== view.mySeat && view.handCounts?.[i] > 0) {
      const fan = el('div', 'eventail');
      const nb = Math.min(view.handCounts[i], 8);
      for (let k = 0; k < nb; k++) {
        const dos = renderCardBack({ size: 'petite' });
        dos.style.transform = `rotate(${(k - (nb - 1) / 2) * 7}deg) translateY(${Math.abs(k - (nb - 1) / 2) * 2}px)`;
        fan.appendChild(dos);
      }
      fan.appendChild(el('span', 'eventail-nb', String(view.handCounts[i])));
      plate.appendChild(fan);
    }

    // Bulle de dialogue : enchère en cours, ou annonce transitoire.
    const bulle = bulleTexte(view, ui, i);
    if (bulle) {
      const b = el('div', 'bulle', bulle);
      plate.appendChild(b);
    }
    plateau.appendChild(plate);
  }
}

function bulleTexte(view, ui, seat) {
  const transient = ui.bubbles[seat];
  if (transient && Date.now() - transient.ts < BULLE_DUREE) return transient.text;
  if (view.phase === PHASES.ENCHERES && view.bids[seat]) {
    return BID_LABELS[view.bids[seat]];
  }
  return null;
}

// ------------------------------------------------------------------- Centre

function renderCenter(plateau, view, ui) {
  const n = view.nbJoueurs;

  // Le chien, face cachée pendant les enchères et l'appel, révélé à l'écart.
  if (view.phase === PHASES.ENCHERES || view.phase === PHASES.APPEL_ROI) {
    const zone = el('div', 'zone-chien');
    const row = el('div', 'rangee-cartes');
    for (let k = 0; k < view.chienSize; k++) row.appendChild(renderCardBack({ size: 'moyenne' }));
    zone.appendChild(row);
    plateau.appendChild(zone);
  }

  if (view.phase === PHASES.ENCHERES) {
    if (view.actions?.type === 'enchere') {
      plateau.appendChild(renderPanneauContrat(view, ui));
    }
    return;
  }
  if (view.phase === PHASES.APPEL_ROI) {
    if (view.actions?.type === 'appelRoi') {
      plateau.appendChild(renderPanneauAppel(view));
    } else {
      plateau.appendChild(
        el('div', 'message-centre', `${view.seats[view.takerSeat].name} appelle un roi…`)
      );
    }
    return;
  }
  if (view.phase === PHASES.ECART) {
    if (view.chien) {
      const zone = el('div', 'zone-chien');
      zone.appendChild(el('div', 'zone-titre', 'Le chien'));
      zone.appendChild(renderCardRow(view.chien, { size: 'moyenne', extraClass: 'retournee' }));
      if (view.mySeat !== view.takerSeat) {
        zone.appendChild(
          el('div', 'zone-sous-titre', `${view.seats[view.takerSeat].name} fait son écart…`)
        );
      }
      plateau.appendChild(zone);
    }
    return;
  }
  if (view.phase === PHASES.JEU || view.phase === PHASES.FIN_DONNE) {
    for (const { seat, card } of view.trick) {
      const rel = (seat - view.mySeat + n) % n;
      const wrap = el('div', `pli-carte pli-${POSITIONS[n][rel]}`);
      wrap.appendChild(renderCard(card));
      plateau.appendChild(wrap);
    }
  }
}

// Panneau doré « Contrat » (façon appli mobile) : les 4 contrats + Passer.
function renderPanneauContrat(view, ui) {
  const panneau = el('div', 'panneau-or panneau-contrat');
  panneau.appendChild(el('h2', '', 'Contrat'));
  const grille = el('div', 'grille-contrats');
  const legales = new Set(view.actions.encheres);
  for (const c of CONTRACTS) {
    const b = bouton(`${BID_LABELS[c]} (x${CONTRACT_MULT[c]})`, async () => {
      const r = await emit('jeu:action', { type: 'enchere', enchere: c });
      if (r.error) toast(r.error, { type: 'error' });
    }, 'btn-bleu');
    if (!legales.has(c)) b.disabled = true;
    grille.appendChild(b);
  }
  panneau.appendChild(grille);

  const basRow = el('div', 'contrat-bas');
  const chelem = el('label', 'case-chelem');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = ui.pendingChelem;
  box.addEventListener('change', () => {
    ui.pendingChelem = box.checked;
  });
  chelem.appendChild(box);
  chelem.appendChild(el('span', '', 'Chelem'));
  chelem.title = 'Si vous prenez, le chelem sera annoncé avec votre première carte';
  basRow.appendChild(chelem);
  basRow.appendChild(
    bouton('Passer', async () => {
      const r = await emit('jeu:action', { type: 'enchere', enchere: 'passe' });
      if (r.error) toast(r.error, { type: 'error' });
    }, 'btn-vert')
  );
  panneau.appendChild(basRow);
  return panneau;
}

function renderPanneauAppel(view) {
  const panneau = el('div', 'panneau-or panneau-contrat');
  panneau.appendChild(el('h2', '', 'Appelez votre partenaire'));
  panneau.appendChild(
    el('p', 'panneau-aide', 'Le détenteur de la carte sera votre partenaire secret. Appeler une carte que vous détenez : vous jouez seul.')
  );
  const row = el('div', 'rangee-cartes rangee-cliquable');
  for (const id of view.actions.cartes) {
    const c = renderCard(id, { size: 'moyenne', extraClass: 'jouable' });
    c.addEventListener('click', async () => {
      const r = await emit('jeu:action', { type: 'appelRoi', carte: id });
      if (r.error) toast(r.error, { type: 'error' });
    });
    row.appendChild(c);
  }
  panneau.appendChild(row);
  return panneau;
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

  if (actions?.type === 'ecart') {
    const sel = ui.ecartSel;
    barre.appendChild(el('span', 'invite', `Écart : ${sel.size}/${actions.nb} cartes choisies`));
    const valider = bouton('Valider l’écart', async () => {
      const r = await emit('jeu:action', { type: 'ecart', cartes: [...sel] });
      if (r.error) toast(r.error, { type: 'error' });
      else ui.ecartSel = new Set();
    }, 'btn-vert');
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
        }, 'btn-vert')
      );
    }
  } else if (
    view.currentSeat !== null &&
    view.currentSeat !== view.mySeat &&
    view.phase !== PHASES.ENCHERES
  ) {
    barre.appendChild(el('span', 'invite invite-attente', `Au tour de ${view.seats[view.currentSeat].name}…`));
  }
  zone.appendChild(barre);

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
      }, 'btn-bleu btn-mini')
    );
  }
  if (actions.chelemPossible) {
    barre.appendChild(
      bouton('Annoncer un chelem', () => {
        ui.pendingChelem = true;
        ui.rerender();
      }, 'btn-bleu btn-mini')
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
  if (view.phase === PHASES.ENCHERES && ui.dealAnim !== view.donne) {
    ui.dealAnim = view.donne;
    main.classList.add('nouvelle');
  }
  const actions = view.actions;
  const jouables = new Set(actions?.type === 'carte' ? actions.cartes : []);
  const ecartables = new Set(actions?.type === 'ecart' ? actions.ecartables : []);

  view.maMain.forEach((id, idx) => {
    let cls = '';
    if (actions?.type === 'carte') cls = jouables.has(id) ? 'jouable' : 'inerte';
    if (actions?.type === 'ecart') {
      cls = ecartables.has(id) ? 'jouable' : 'inerte';
      if (ui.ecartSel.has(id)) cls += ' choisie';
    }
    const c = renderCard(id, { extraClass: cls });
    c.style.setProperty('--i', idx);
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
  });
  return main;
}

// ------------------------------------------------------------------ Modales

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
      }, 'btn-vert')
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
