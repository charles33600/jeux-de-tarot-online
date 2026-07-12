import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDonne, countPoints } from '../shared/scoring.js';
import { buildDeck } from '../shared/cards.js';

// Petit utilitaire : fabrique un paquet de cartes d'attaque totalisant `pts`
// points avec exactement `oudlers` bouts (rois 4.5, dames 3.5, basses 0.5).
function attackCardsWith(pts, oudlers) {
  const cards = ['A-21', 'A-1', 'EX'].slice(0, oudlers);
  let remaining = pts - oudlers * 4.5;
  const suits = ['P', 'C', 'K', 'T'];
  for (let i = 0; remaining >= 5 && i < 4; i++) {
    cards.push(`${suits[i]}-14`);
    remaining -= 4.5;
  }
  for (let i = 0; remaining >= 4 && i < 4; i++) {
    cards.push(`${suits[i]}-13`);
    remaining -= 3.5;
  }
  const lows = [];
  for (const s of suits) for (let r = 2; r <= 10; r++) lows.push(`${s}-${r}`);
  for (let n = 2; n <= 20; n++) lows.push(`A-${n}`);
  for (let i = 0; remaining > 0.25; i++) {
    cards.push(lows[i]);
    remaining -= 0.5;
  }
  assert.equal(countPoints(cards), pts);
  return cards;
}

test('garde réussie : 2 bouts, 46 points → (25 + 5) × 2 = 60', () => {
  const r = scoreDonne({
    nbJoueurs: 4,
    contract: 'garde',
    attackCards: attackCardsWith(46, 2),
    takerSeat: 0,
  });
  assert.equal(r.made, true);
  assert.equal(r.total, 60);
  assert.deepEqual(r.deltas, [180, -60, -60, -60]);
});

test('petite chutée : 1 bout, 46 points → -(25 + 5) × 1 = -30', () => {
  const r = scoreDonne({
    nbJoueurs: 3,
    contract: 'petite',
    attackCards: attackCardsWith(46, 1),
    takerSeat: 1,
  });
  assert.equal(r.made, false);
  assert.equal(r.total, -30);
  assert.deepEqual(r.deltas, [30, -60, 30]);
});

test('le demi-point est arrondi en faveur du camp vainqueur', () => {
  // 41.5 points avec 2 bouts (cible 41) : différence 0.5 → comptée 1 → 26.
  const win = scoreDonne({
    nbJoueurs: 4,
    contract: 'petite',
    attackCards: attackCardsWith(41.5, 2),
    takerSeat: 0,
  });
  assert.equal(win.total, 26);
  // 40.5 points : chute de 0.5 → comptée 1 → -26.
  const lose = scoreDonne({
    nbJoueurs: 4,
    contract: 'petite',
    attackCards: attackCardsWith(40.5, 2),
    takerSeat: 0,
  });
  assert.equal(lose.total, -26);
});

test('petit au bout : ±10 multiplié par le contrat', () => {
  const r = scoreDonne({
    nbJoueurs: 4,
    contract: 'garde',
    attackCards: attackCardsWith(46, 2),
    takerSeat: 0,
    petitAuBout: 'attack',
  });
  assert.equal(r.total, 80); // (25 + 5 + 10) × 2
  const r2 = scoreDonne({
    nbJoueurs: 4,
    contract: 'garde',
    attackCards: attackCardsWith(46, 2),
    takerSeat: 0,
    petitAuBout: 'defense',
  });
  assert.equal(r2.total, 40); // (25 + 5 - 10) × 2
});

test('la poignée revient au camp vainqueur, non multipliée', () => {
  const made = scoreDonne({
    nbJoueurs: 4,
    contract: 'garde',
    attackCards: attackCardsWith(46, 2),
    takerSeat: 0,
    poignees: [{ seat: 2, level: 0 }],
  });
  assert.equal(made.total, 80); // 60 + 20, même déclarée par la défense
  const lost = scoreDonne({
    nbJoueurs: 4,
    contract: 'garde',
    attackCards: attackCardsWith(36, 2),
    takerSeat: 0,
    poignees: [{ seat: 0, level: 1 }],
  });
  assert.equal(lost.total, -90); // -(25+5)×2 - 30
});

test('à 5 joueurs : preneur 2 parts, partenaire 1 part, somme nulle', () => {
  const r = scoreDonne({
    nbJoueurs: 5,
    contract: 'petite',
    attackCards: attackCardsWith(46, 2),
    takerSeat: 0,
    partnerSeat: 2,
  });
  assert.equal(r.total, 30);
  assert.deepEqual(r.deltas, [60, -30, 30, -30, -30]);
  assert.equal(r.deltas.reduce((a, b) => a + b, 0), 0);
});

test('à 5 joueurs seul (appel à soi-même) : 4 parts', () => {
  const r = scoreDonne({
    nbJoueurs: 5,
    contract: 'petite',
    attackCards: attackCardsWith(46, 2),
    takerSeat: 0,
    partnerSeat: 0,
  });
  assert.deepEqual(r.deltas, [120, -30, -30, -30, -30]);
});

test('chelem non annoncé réussi : +200', () => {
  const r = scoreDonne({
    nbJoueurs: 4,
    contract: 'garde',
    attackCards: buildDeck(),
    takerSeat: 0,
    chelem: { attackWonAll: true, announced: false },
  });
  assert.equal(r.total, (25 + 55) * 2 + 200);
});

test('cibles selon les bouts : 56 / 51 / 41 / 36', () => {
  for (const [oudlers, target] of [[0, 56], [1, 51], [2, 41], [3, 36]]) {
    const r = scoreDonne({
      nbJoueurs: 4,
      contract: 'petite',
      attackCards: attackCardsWith(target, oudlers),
      takerSeat: 0,
    });
    assert.equal(r.target, target);
    assert.equal(r.made, true);
    assert.equal(r.total, 25);
  }
});
