// Routage des écrans, reconnexion automatique, événements transitoires.

import { socket, emit } from './net.js';
import { renderAccueil, renderLobby } from './ui/accueil.js';
import { renderTable } from './ui/table.js';
import { toast } from './ui/dialogues.js';
import { renderCardRow } from './ui/cartes.js';
import { sons } from './son.js';
import { CONTRACT_NAMES, POIGNEE_NAMES } from '/shared/constants.js';
import { cardName } from '/shared/cards.js';

const app = document.getElementById('app');
let view = null;

// État d'interface persistant entre deux rendus (sélection d'écart, etc.).
const ui = {
  donneKey: null,
  ecartSel: new Set(),
  pendingPoignee: null,
  pendingChelem: false,
  poigneeRefusee: false,
  resultFerme: false,
  showScores: false,
  rerender: () => render(),
};

function render() {
  if (!view) return renderAccueil(app);
  if (view.ecran === 'lobby') return renderLobby(app, view);
  renderTable(app, view, ui);
}

socket.on('etat', (v) => {
  const prev = view;
  view = v;
  jouerSons(prev, v);
  const finAnim = preparerRamassage(prev, v);
  render();
  finAnim?.();
});

// Bruitages déclenchés par les transitions d'état (les cartes des bots
// arrivent via 'etat', pas via 'evenement').
function jouerSons(prev, v) {
  if (v.ecran !== 'table') return;
  const p = prev?.ecran === 'table' ? prev : null;
  if (!p || p.donne !== v.donne) {
    if (v.phase === 'ENCHERES') sons.distribution();
  } else if ((v.trick?.length ?? 0) > (p.trick?.length ?? 0)) {
    sons.carte();
  }
  const actif = (x) => x?.actions && x.actions.type !== 'donneSuivante';
  if (actif(v) && !actif(p)) sons.tour();
  if (v.phase === 'FIN_DONNE' && v.result && p && p.phase !== 'FIN_DONNE') {
    (v.result.deltas[v.mySeat] >= 0 ? sons.victoire : sons.defaite)();
  }
}

// Animation de ramassage : quand le pli vient d'être résolu, les cartes
// affichées volent vers le siège du gagnant. On capture leurs positions
// AVANT le re-rendu, on anime des clones après.
function preparerRamassage(prev, v) {
  if (
    !prev ||
    prev.ecran !== 'table' ||
    v.ecran !== 'table' ||
    prev.donne !== v.donne ||
    !prev.trick?.length ||
    v.trick?.length !== 0 ||
    !v.lastTrick
  ) {
    return null;
  }
  const clones = [...document.querySelectorAll('.pli-carte .carte')].map((el) => {
    const r = el.getBoundingClientRect();
    const c = el.cloneNode(true);
    c.classList.add('carte-vol');
    c.style.left = `${r.left}px`;
    c.style.top = `${r.top}px`;
    return c;
  });
  if (!clones.length) return null;
  return () => {
    const cible = document.querySelector(`.siege[data-seat="${v.lastTrick.winnerSeat}"]`);
    if (!cible) return;
    const r = cible.getBoundingClientRect();
    for (const c of clones) document.body.appendChild(c);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const c of clones) {
          c.style.left = `${r.left + r.width / 2 - 22}px`;
          c.style.top = `${r.top + r.height / 2 - 32}px`;
          c.style.opacity = '0';
          c.style.transform = 'scale(0.3)';
        }
      })
    );
    setTimeout(() => clones.forEach((c) => c.remove()), 800);
  };
}

socket.on('erreur', ({ message }) => toast(message, { type: 'error' }));

socket.on('evenement', (evt) => {
  const nom = (seat) => view?.seats?.[seat]?.name ?? 'Un joueur';
  switch (evt.type) {
    case 'preneur':
      toast(`${nom(evt.seat)} prend : ${CONTRACT_NAMES[evt.contract]}.`);
      sons.annonce();
      break;
    case 'appel':
      toast(`Le preneur appelle ${cardName(evt.carte)}.`);
      break;
    case 'chien':
      toast('Le chien est révélé.', { cards: renderCardRow(evt.cartes, { size: 'petite' }) });
      break;
    case 'atoutsEcartes':
      toast("Atouts mis à l'écart (montrés) :", { cards: renderCardRow(evt.cartes, { size: 'petite' }) });
      break;
    case 'poignee':
      toast(`${nom(evt.seat)} annonce une ${POIGNEE_NAMES[evt.level].toLowerCase()} !`, {
        cards: renderCardRow(evt.cards, { size: 'petite' }),
        duration: 6000,
      });
      sons.fanfare();
      break;
    case 'partenaire':
      toast(
        evt.auChien
          ? 'La carte appelée était au chien : le preneur joue seul !'
          : `${nom(evt.seat)} est le partenaire du preneur !`
      );
      sons.annonce();
      break;
    case 'chelem':
      toast(`${nom(evt.seat)} annonce un CHELEM !`, { type: 'error', duration: 6000 });
      sons.fanfare();
      break;
    case 'pli':
      toast(`${nom(evt.winnerSeat)} remporte le pli.`, { duration: 1800 });
      sons.pli();
      break;
    case 'redonne':
      toast('Tout le monde passe : nouvelle donne.');
      break;
    case 'deconnecte':
      toast(`${evt.name} s'est déconnecté…`);
      break;
    case 'remplace':
      toast(`${evt.name} est remplacé par une IA.`);
      break;
    case 'reconnecte':
      toast(`${evt.name} est de retour !`);
      break;
    case 'tableFermee':
      toast("L'hôte a fermé la table.", { type: 'error' });
      localStorage.removeItem('tarot.token');
      view = null;
      render();
      break;
  }
});

// À la (re)connexion : tente de reprendre la session via le token stocké.
socket.on('connect', async () => {
  const token = localStorage.getItem('tarot.token');
  if (!token) return render();
  const r = await emit('table:reconnecter', { token });
  if (!r.ok) {
    localStorage.removeItem('tarot.token');
    view = null;
    render();
  }
  // sinon, l'état complet arrive via l'événement 'etat'
});

socket.on('disconnect', () => {
  toast('Connexion au serveur perdue, reconnexion…', { type: 'error' });
});

render();
