// Simulation de bout en bout : des donnes complètes jouées par des bots via
// le vrai orchestrateur (sans sockets), avec vérification d'invariants.
// Usage : npm run simulate [nbDonnes]

import assert from 'node:assert/strict';
import { GameRoom } from '../server/gameRoom.js';
import { mulberry32 } from '../shared/deal.js';
import { countPoints } from '../shared/scoring.js';
import { CONTRACT_NAMES } from '../shared/constants.js';

const NB_DONNES = Number(process.argv[2] ?? 100);

async function simulate(nbJoueurs, nbDonnes, seed) {
  const seats = Array.from({ length: nbJoueurs }, (_, i) => ({
    name: `Bot ${i + 1}`,
    isBot: true,
    connected: false,
  }));
  const stats = { donnes: 0, made: 0, contracts: {}, redonnes: 0 };

  await new Promise((resolve, reject) => {
    const room = new GameRoom({
      nbJoueurs,
      seats,
      rng: mulberry32(seed),
      botDelay: () => 0,
      resolveDelay: () => 0,
      onEvent: (evt) => {
        if (evt.type === 'redonne') stats.redonnes++;
      },
      onDonneEnd: (result) => {
        try {
          const g = room.g;
          const all = [...g.piles[0], ...g.piles[1]];
          assert.equal(all.length, 78, '78 cartes réparties entre les deux camps');
          assert.equal(new Set(all).size, 78, 'aucune carte dupliquée');
          assert.equal(countPoints(all), 91, '91 points au total');
          assert.equal(
            result.deltas.reduce((a, b) => a + b, 0),
            0,
            'somme des scores nulle'
          );
          assert.equal(
            room.totals.reduce((a, b) => a + b, 0),
            0,
            'cumul des scores à somme nulle'
          );
          if (g.excuseDebt) {
            // La dette ne peut rester que si le camp débiteur n'a aucune basse carte.
            const pile = g.piles[g.excuseDebt.from];
            assert.equal(
              pile.some((c) => c !== 'EX' && countPoints([c]) === 0.5),
              false,
              "dette d'Excuse non soldée alors qu'une basse carte était disponible"
            );
          }
          for (const h of g.hands) assert.equal(h.length, 0, 'toutes les mains vidées');

          stats.donnes++;
          if (result.made) stats.made++;
          stats.contracts[g.contract] = (stats.contracts[g.contract] ?? 0) + 1;
          if (stats.donnes >= nbDonnes) {
            room.destroy();
            resolve();
          } else {
            queueMicrotask(() => room.act(0, 'donneSuivante'));
          }
        } catch (e) {
          room.destroy();
          reject(e);
        }
      },
    });
    room.startDonne();
  });
  return stats;
}

for (const nb of [3, 4, 5]) {
  const t0 = Date.now();
  const stats = await simulate(nb, NB_DONNES, 20260712 + nb);
  const contracts = Object.entries(stats.contracts)
    .map(([c, n]) => `${CONTRACT_NAMES[c]}: ${n}`)
    .join(', ');
  console.log(
    `✔ ${nb} joueurs — ${stats.donnes} donnes en ${Date.now() - t0} ms, ` +
      `${stats.redonnes} redonnes (tous passent), ` +
      `contrats réussis : ${((stats.made / stats.donnes) * 100).toFixed(0)} % (${contracts})`
  );
}
console.log('Simulation terminée sans violation d’invariant.');
