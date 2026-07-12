import test from 'node:test';
import assert from 'node:assert/strict';
import { deal, mulberry32 } from '../shared/deal.js';
import { DEAL_CONFIG } from '../shared/constants.js';

for (const nb of [3, 4, 5]) {
  test(`donne à ${nb} joueurs : tailles et conservation des 78 cartes`, () => {
    const rng = mulberry32(42 + nb);
    const { hands, chien } = deal(nb, rng);
    assert.equal(hands.length, nb);
    for (const h of hands) assert.equal(h.length, DEAL_CONFIG[nb].hand);
    assert.equal(chien.length, DEAL_CONFIG[nb].chien);
    const all = [...hands.flat(), ...chien];
    assert.equal(all.length, 78);
    assert.equal(new Set(all).size, 78);
  });
}

test('la donne est reproductible avec la même graine', () => {
  const a = deal(4, mulberry32(7));
  const b = deal(4, mulberry32(7));
  assert.deepEqual(a, b);
});
