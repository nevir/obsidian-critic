import assert from 'node:assert/strict';
import test from 'node:test';

import { focusedCardTargetTop } from '../../../src/core/layout/index.ts';
import { RAIL_HEIGHT } from '../../fixtures/layout.ts';

const EPSILON = 1e-6;

test('focused cards follow the pin, clamp, and release envelope', () => {
  const height = 190;
  const bottomEdge = RAIL_HEIGHT - 8;
  const bottomPinnedTop = bottomEdge - height;
  const itemAt = (naturalTop: number) => ({ naturalTop, height });

  assert.equal(focusedCardTargetTop(itemAt(0), RAIL_HEIGHT), 0);
  assert.equal(
    focusedCardTargetTop(itemAt(bottomPinnedTop), RAIL_HEIGHT),
    bottomPinnedTop,
  );
  assert.equal(
    focusedCardTargetTop(itemAt(bottomEdge), RAIL_HEIGHT),
    bottomPinnedTop,
  );
  assert.ok(focusedCardTargetTop(itemAt(-1), RAIL_HEIGHT) < -1);
  assert.ok(
    focusedCardTargetTop(itemAt(bottomEdge + 1), RAIL_HEIGHT) > bottomPinnedTop,
  );

  let previous = focusedCardTargetTop(itemAt(bottomEdge + 400), RAIL_HEIGHT);
  for (let naturalTop = bottomEdge + 399; naturalTop >= -400; naturalTop -= 1) {
    const target = focusedCardTargetTop(itemAt(naturalTop), RAIL_HEIGHT);
    const delta = target - previous;
    assert.ok(delta <= EPSILON, `reversed at ${naturalTop} by ${delta}`);
    assert.ok(
      Math.abs(delta) <= 2 + EPSILON,
      `jumped at ${naturalTop} by ${delta}`,
    );
    if (naturalTop >= 0 && naturalTop <= bottomPinnedTop) {
      assert.equal(target, naturalTop);
    }
    if (naturalTop > bottomPinnedTop && naturalTop <= bottomEdge) {
      assert.equal(target, bottomPinnedTop);
      assert.ok(naturalTop >= target && naturalTop <= target + height);
    }
    previous = target;
  }
});

test('tall focused cards use their explicit local offset', () => {
  const item = { naturalTop: 40, height: RAIL_HEIGHT + 200 };
  assert.equal(focusedCardTargetTop(item, RAIL_HEIGHT, 0), 40);
  assert.equal(focusedCardTargetTop(item, RAIL_HEIGHT, 120), -80);
});
