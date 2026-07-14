import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_CRITIC_SETTINGS,
  normalizeCriticSettings,
} from '../../src/obsidian/settings.ts';

test('defaults missing and invalid saved settings to Original', () => {
  for (const value of [
    undefined,
    null,
    [],
    'proposed',
    {},
    { readingProjection: 'future' },
  ]) {
    assert.deepEqual(normalizeCriticSettings(value), DEFAULT_CRITIC_SETTINGS);
  }
});

test('accepts only the persisted Proposed value', () => {
  assert.deepEqual(normalizeCriticSettings({ readingProjection: 'proposed' }), {
    readingProjection: 'proposed',
  });
  assert.deepEqual(
    normalizeCriticSettings({ readingProjection: 'original', extra: true }),
    DEFAULT_CRITIC_SETTINGS,
  );
});

test('returns a fresh settings value', () => {
  assert.notEqual(normalizeCriticSettings(null), DEFAULT_CRITIC_SETTINGS);
});
