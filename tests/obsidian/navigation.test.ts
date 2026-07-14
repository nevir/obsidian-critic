import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjacentReviewId,
  reconcileFocusedReviewId,
} from '../../src/obsidian/review/navigation.ts';

test('navigation is bounded and only operates from an existing focus', () => {
  const ids = ['a', 'b', 'c'];

  assert.equal(adjacentReviewId(ids, null, 1), null);
  assert.equal(adjacentReviewId(ids, 'missing', 1), null);
  assert.equal(adjacentReviewId(ids, 'a', -1), null);
  assert.equal(adjacentReviewId(ids, 'a', 1), 'b');
  assert.equal(adjacentReviewId(ids, 'c', 1), null);
});

test('focus reconciliation chooses the next item, then the previous item', () => {
  assert.equal(reconcileFocusedReviewId(['a', 'b', 'c'], ['a', 'c'], 'b'), 'c');
  assert.equal(reconcileFocusedReviewId(['a', 'b', 'c'], ['a', 'b'], 'c'), 'b');
  assert.equal(reconcileFocusedReviewId(['a'], [], 'a'), null);
  assert.equal(reconcileFocusedReviewId(['a'], ['a'], 'a'), 'a');
});
