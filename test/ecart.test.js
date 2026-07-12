import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEcart } from '../shared/ecart.js';
import { poigneeOptions } from '../shared/poignee.js';

const HAND = [
  'P-2', 'P-5', 'P-14',
  'C-3', 'C-7', 'C-13',
  'K-4', 'K-9',
  'T-6', 'T-10',
  'A-1', 'A-8', 'A-21',
  'EX',
];

test('écart valide de 6 cartes basses', () => {
  const r = validateEcart(HAND, ['P-2', 'P-5', 'C-3', 'C-7', 'K-4', 'T-6'], 6);
  assert.ok(r.ok);
  assert.deepEqual(r.shownTrumps, []);
});

test('interdit : roi, bout, Excuse', () => {
  assert.ok(!validateEcart(HAND, ['P-14', 'P-5', 'C-3', 'C-7', 'K-4', 'T-6'], 6).ok);
  assert.ok(!validateEcart(HAND, ['A-21', 'P-5', 'C-3', 'C-7', 'K-4', 'T-6'], 6).ok);
  assert.ok(!validateEcart(HAND, ['EX', 'P-5', 'C-3', 'C-7', 'K-4', 'T-6'], 6).ok);
});

test('interdit : écarter la carte appelée', () => {
  const r = validateEcart(HAND, ['C-13', 'P-5', 'C-3', 'C-7', 'K-4', 'T-6'], 6, 'C-13');
  assert.ok(!r.ok);
});

test("atout refusé s'il reste d'autres cartes écartables", () => {
  const r = validateEcart(HAND, ['A-8', 'P-5', 'C-3', 'C-7', 'K-4', 'T-6'], 6);
  assert.ok(!r.ok);
});

test('atout forcé et montré quand il n’y a pas assez d’autres cartes', () => {
  // 5 cartes écartables seulement : le 6e écart doit être un atout, montré.
  const hand = ['P-2', 'C-3', 'K-4', 'T-6', 'T-10', 'P-14', 'C-14', 'A-1', 'A-21', 'EX', 'A-5', 'A-9'];
  const r = validateEcart(hand, ['P-2', 'C-3', 'K-4', 'T-6', 'T-10', 'A-5'], 6);
  assert.ok(r.ok);
  assert.deepEqual(r.shownTrumps, ['A-5']);
});

test('poignées : seuils par variante et règle de l’Excuse', () => {
  const trumps10 = Array.from({ length: 10 }, (_, i) => `A-${i + 2}`);
  // 10 atouts à 4 joueurs : simple poignée seulement.
  const opts4 = poigneeOptions([...trumps10, 'P-2'], 4);
  assert.deepEqual(opts4.map((o) => o.level), [0]);
  // 9 atouts + Excuse à 4 joueurs : l'Excuse complète la simple poignée.
  const opts4ex = poigneeOptions([...trumps10.slice(0, 9), 'EX', 'P-2'], 4);
  assert.deepEqual(opts4ex.map((o) => o.level), [0]);
  assert.ok(opts4ex[0].cards.includes('EX'));
  // 10 atouts + Excuse : l'Excuse ne peut pas être montrée pour la simple (10 suffisent),
  // mais complète la double (13) ? Non : 11 < 13. Une seule option.
  const opts = poigneeOptions([...trumps10, 'EX', 'P-2'], 4);
  assert.deepEqual(opts.map((o) => o.level), [0]);
  assert.ok(!opts[0].cards.includes('EX'));
  // 8 atouts à 5 joueurs : simple poignée.
  const opts5 = poigneeOptions([...trumps10.slice(0, 8), 'P-2'], 5);
  assert.deepEqual(opts5.map((o) => o.level), [0]);
  // 13 atouts à 3 joueurs : simple seulement (double = 15).
  const trumps13 = Array.from({ length: 13 }, (_, i) => `A-${i + 2}`);
  assert.deepEqual(poigneeOptions([...trumps13, 'P-2'], 3).map((o) => o.level), [0]);
});
