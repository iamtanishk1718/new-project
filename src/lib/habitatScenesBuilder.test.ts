import test from 'node:test';
import assert from 'node:assert/strict';
import { HABITAT_ANIMATION_META } from './habitatScenesBuilder';
import { HABITAT_PROFILES } from './constants';
import { HabitatType } from '../types/habitat';

test('Every habitat profile has distinct animation metadata and summary', () => {
  const types = Object.keys(HABITAT_PROFILES) as HabitatType[];
  assert.equal(types.length, 7);

  const summaries = new Set<string>();
  const shortNames = new Set<string>();

  for (const type of types) {
    const meta = HABITAT_ANIMATION_META[type];
    assert.ok(meta, `Missing animation metadata for habitat ${type}`);
    assert.ok(meta.shortName.length >= 4);
    assert.ok(meta.animationSummary.length >= 10);
    summaries.add(meta.animationSummary);
    shortNames.add(meta.shortName);
  }

  assert.equal(summaries.size, 7);
  assert.equal(shortNames.size, 7);
});
