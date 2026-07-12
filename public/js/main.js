// Routage des écrans, reconnexion automatique, événements transitoires.

import { socket, emit } from './net.js';
import { renderAccueil, renderLobby } from './ui/accueil.js';
import { renderTable } from './ui/table.js';
import { toast } from './ui/dialogues.js';
import { renderCardRow } from './ui/cartes.js';
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
  view = v;
  render();
});

socket.on('erreur', ({ message }) => toast(message, { type: 'error' }));

socket.on('evenement', (evt) => {
  const nom = (seat) => view?.seats?.[seat]?.name ?? 'Un joueur';
  switch (evt.type) {
    case 'preneur':
      toast(`${nom(evt.seat)} prend : ${CONTRACT_NAMES[evt.contract]}.`);
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
      break;
    case 'partenaire':
      toast(
        evt.auChien
          ? 'La carte appelée était au chien : le preneur joue seul !'
          : `${nom(evt.seat)} est le partenaire du preneur !`
      );
      break;
    case 'chelem':
      toast(`${nom(evt.seat)} annonce un CHELEM !`, { type: 'error', duration: 6000 });
      break;
    case 'pli':
      toast(`${nom(evt.winnerSeat)} remporte le pli.`, { duration: 1800 });
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
