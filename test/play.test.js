import test from 'node:test';
import assert from 'node:assert/strict';
import { legalMoves, trickWinner, ledSuitOf } from '../shared/play.js';

const t = (...cards) => cards.map((card, i) => ({ seat: i, card }));

test('entame : toute la main est jouable', () => {
  const hand = ['P-2', 'C-14', 'A-5', 'EX'];
  assert.deepEqual(legalMoves(hand, []), hand);
});

test('obligation de fournir la couleur demandée', () => {
  const hand = ['P-2', 'P-10', 'C-14', 'A-5'];
  const moves = legalMoves(hand, t('P-7'));
  assert.deepEqual(new Set(moves), new Set(['P-2', 'P-10']));
});

test("l'Excuse est toujours jouable", () => {
  const hand = ['P-2', 'EX'];
  const moves = legalMoves(hand, t('P-7'));
  assert.ok(moves.includes('EX'));
  assert.ok(moves.includes('P-2'));
});

test('défaussé de la couleur : obligation de couper', () => {
  const hand = ['C-3', 'A-5', 'A-10'];
  const moves = legalMoves(hand, t('P-7'));
  assert.deepEqual(new Set(moves), new Set(['A-5', 'A-10']));
});

test('obligation de monter sur un atout déjà joué (surcoupe)', () => {
  const hand = ['C-3', 'A-5', 'A-12'];
  const moves = legalMoves(hand, t('P-7', 'A-8'));
  assert.deepEqual(moves, ['A-12']);
});

test('impossible de monter : on doit quand même jouer un atout inférieur (pisser)', () => {
  const hand = ['C-3', 'A-5', 'A-7'];
  const moves = legalMoves(hand, t('P-7', 'A-8'));
  assert.deepEqual(new Set(moves), new Set(['A-5', 'A-7']));
});

test("l'obligation de monter vaut même si le partenaire est maître", () => {
  // Le pli est tenu par l'atout 10 (peu importe qui l'a joué) : il faut monter.
  const hand = ['A-11', 'A-2'];
  const moves = legalMoves(hand, t('K-5', 'A-10'));
  assert.deepEqual(moves, ['A-11']);
});

test('atout demandé : obligation de monter sur le plus fort', () => {
  const hand = ['A-3', 'A-15', 'C-14'];
  const moves = legalMoves(hand, t('A-9', 'A-12'));
  assert.deepEqual(moves, ['A-15']);
});

test('sans atout ni couleur demandée : défausse libre', () => {
  const hand = ['C-3', 'K-14'];
  const moves = legalMoves(hand, t('P-7', 'A-8'));
  assert.deepEqual(new Set(moves), new Set(['C-3', 'K-14']));
});

test("l'Excuse en entame : la carte suivante est libre et fixe la couleur", () => {
  const hand = ['C-3', 'P-2', 'A-4'];
  const moves = legalMoves(hand, t('EX'));
  assert.deepEqual(new Set(moves), new Set(hand));
  assert.equal(ledSuitOf(t('EX', 'C-9')), 'C');
});

test('5 joueurs : le preneur ne peut pas entamer de la couleur appelée au 1er pli', () => {
  const hand = ['C-3', 'C-10', 'P-2', 'A-4', 'C-14'];
  const ctx = { firstTrick: true, isTaker: true, calledCard: 'C-14' };
  const moves = legalMoves(hand, [], ctx);
  // C-3 et C-10 interdits, mais la carte appelée elle-même (ici détenue : appel à soi) est permise.
  assert.deepEqual(new Set(moves), new Set(['P-2', 'A-4', 'C-14']));
});

test('vainqueur du pli : plus fort atout, sinon plus forte carte de la couleur demandée', () => {
  assert.equal(trickWinner(t('P-7', 'P-14', 'C-2', 'P-10')).card, 'P-14');
  assert.equal(trickWinner(t('P-7', 'A-2', 'A-14', 'P-14')).card, 'A-14');
});

test("l'Excuse ne gagne jamais le pli", () => {
  assert.equal(trickWinner(t('P-7', 'EX', 'P-9')).card, 'P-9');
  assert.equal(trickWinner(t('EX', 'C-4', 'C-11')).card, 'C-11');
});
