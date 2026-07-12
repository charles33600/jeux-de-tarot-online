// Écran d'accueil (créer / rejoindre) et écran de lobby (avant la partie).

import { emit } from '../net.js';
import { toast, bouton, el } from './dialogues.js';

export function renderAccueil(app) {
  app.innerHTML = '';
  const page = el('div', 'accueil');
  page.appendChild(el('h1', 'titre', '🃏 Tarot en ligne'));
  page.appendChild(
    el('p', 'sous-titre', 'Tarot français à 3, 4 ou 5 joueurs — entre humains, ou complété par des IA.')
  );

  const carte = el('div', 'panneau');

  const labelPseudo = el('label', '', 'Votre pseudo');
  const pseudo = document.createElement('input');
  pseudo.maxLength = 20;
  pseudo.placeholder = 'ex. Charles';
  pseudo.value = localStorage.getItem('tarot.pseudo') ?? '';
  labelPseudo.appendChild(pseudo);
  carte.appendChild(labelPseudo);

  // --- Créer une table
  const creer = el('div', 'bloc');
  creer.appendChild(el('h2', '', 'Créer une table'));
  const choix = el('div', 'choix-joueurs');
  let nbJoueurs = 4;
  for (const n of [3, 4, 5]) {
    const b = bouton(`${n} joueurs`, () => {
      nbJoueurs = n;
      choix.querySelectorAll('button').forEach((x) => x.classList.remove('actif'));
      b.classList.add('actif');
    }, n === 4 ? 'actif' : '');
    choix.appendChild(b);
  }
  creer.appendChild(choix);
  creer.appendChild(
    bouton('Créer la table', async () => {
      if (!valide(pseudo)) return;
      const r = await emit('table:creer', { pseudo: pseudo.value, nbJoueurs });
      if (r.error) return toast(r.error, { type: 'error' });
      localStorage.setItem('tarot.token', r.token);
    }, 'btn-principal')
  );
  carte.appendChild(creer);

  // --- Rejoindre une table
  const rejoindre = el('div', 'bloc');
  rejoindre.appendChild(el('h2', '', 'Rejoindre une table'));
  const code = document.createElement('input');
  code.maxLength = 6;
  code.placeholder = 'CODE (6 lettres)';
  code.className = 'champ-code';
  code.addEventListener('input', () => (code.value = code.value.toUpperCase()));
  rejoindre.appendChild(code);
  rejoindre.appendChild(
    bouton('Rejoindre', async () => {
      if (!valide(pseudo)) return;
      if (code.value.trim().length !== 6) return toast('Entrez le code à 6 caractères.', { type: 'error' });
      const r = await emit('table:rejoindre', { pseudo: pseudo.value, code: code.value });
      if (r.error) return toast(r.error, { type: 'error' });
      localStorage.setItem('tarot.token', r.token);
    }, 'btn-principal')
  );
  carte.appendChild(rejoindre);

  page.appendChild(carte);
  app.appendChild(page);

  function valide(input) {
    if (!input.value.trim()) {
      toast('Choisissez un pseudo.', { type: 'error' });
      input.focus();
      return false;
    }
    localStorage.setItem('tarot.pseudo', input.value.trim());
    return true;
  }
}

export function renderLobby(app, view) {
  app.innerHTML = '';
  const page = el('div', 'accueil');
  page.appendChild(el('h1', 'titre', '🃏 Tarot en ligne'));

  const carte = el('div', 'panneau');
  carte.appendChild(el('h2', '', `Table à ${view.nbJoueurs} joueurs`));

  const codeBox = el('div', 'code-table');
  codeBox.appendChild(el('span', 'code-libelle', 'Code de la table'));
  const codeVal = el('div', 'code-valeur', view.code);
  codeVal.title = 'Cliquer pour copier';
  codeVal.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(view.code);
      toast('Code copié !');
    } catch {
      toast(`Code : ${view.code}`);
    }
  });
  codeBox.appendChild(codeVal);
  codeBox.appendChild(el('span', 'code-aide', 'Partagez-le pour inviter les autres joueurs.'));
  carte.appendChild(codeBox);

  const liste = el('ul', 'liste-sieges');
  for (let i = 0; i < view.nbJoueurs; i++) {
    const s = view.seats[i];
    const li = el('li', s ? 'siege-pris' : 'siege-libre');
    if (s) {
      li.textContent = `${s.name}${i === view.hostSeat ? ' (hôte)' : ''}`;
      if (!s.isBot && !s.connected) li.textContent += ' — déconnecté';
    } else {
      li.textContent = 'Siège libre…';
    }
    liste.appendChild(li);
  }
  carte.appendChild(liste);

  const actions = el('div', 'lobby-actions');
  if (view.mySeat === view.hostSeat) {
    const manque = view.nbJoueurs - view.seats.length;
    if (manque > 0) {
      actions.appendChild(
        bouton('+ Ajouter un bot', async () => {
          const r = await emit('table:bot', { action: 'ajouter' });
          if (r.error) toast(r.error, { type: 'error' });
        })
      );
    }
    if (view.seats.some((s) => s.isBot)) {
      actions.appendChild(
        bouton('− Retirer un bot', async () => {
          const r = await emit('table:bot', { action: 'retirer' });
          if (r.error) toast(r.error, { type: 'error' });
        })
      );
    }
    const demarrer = bouton('Démarrer la partie', async () => {
      const r = await emit('table:demarrer');
      if (r.error) toast(r.error, { type: 'error' });
    }, 'btn-principal');
    if (manque > 0) {
      demarrer.disabled = true;
      demarrer.title = 'La table doit être complète (ajoutez des bots ?)';
    }
    actions.appendChild(demarrer);
  } else {
    actions.appendChild(el('p', 'attente', "En attente du lancement par l'hôte…"));
  }
  actions.appendChild(
    bouton('Quitter', async () => {
      await emit('table:quitter');
      localStorage.removeItem('tarot.token');
      window.location.reload();
    }, 'btn-discret')
  );
  carte.appendChild(actions);

  page.appendChild(carte);
  app.appendChild(page);
}
