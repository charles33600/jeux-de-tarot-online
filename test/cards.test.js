import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, isOudler, isTrump, points, sortHand } from '../shared/cards.js';

test('le jeu compte 78 cartes uniques', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 78);
  assert.equal(new Set(deck).size, 78);
});

test('le total des points du jeu est 91', () => {
  const total = buildDeck().reduce((s, c) => s + points(c), 0);
  assert.equal(total, 91);
});

test('les bouts sont le Petit, le 21 et l’Excuse', () => {
  const oudlers = buildDeck().filter(isOudler);
  assert.deepEqual(new Set(oudlers), new Set(['A-1', 'A-21', 'EX']));
});

test('valeurs des cartes', () => {
  assert.equal(points('C-14'), 4.5); // roi
  assert.equal(points('C-13'), 3.5); // dame
  assert.equal(points('C-12'), 2.5); // cavalier
  assert.equal(points('C-11'), 1.5); // valet
  assert.equal(points('C-10'), 0.5);
  assert.equal(points('A-1'), 4.5);
  assert.equal(points('A-21'), 4.5);
  assert.equal(points('EX'), 4.5);
  assert.equal(points('A-15'), 0.5);
});

test('il y a 21 atouts', () => {
  assert.equal(buildDeck().filter(isTrump).length, 21);
});

test('sortHand groupe par couleur et trie par rang, Excuse en dernier', () => {
  const sorted = sortHand(['EX', 'A-3', 'P-14', 'P-2', 'A-1']);
  assert.deepEqual(sorted, ['P-2', 'P-14', 'A-1', 'A-3', 'EX']);
});
