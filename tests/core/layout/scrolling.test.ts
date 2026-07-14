import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginCommentLaneScroll,
  computeExpandedSnapshot,
  createScrollState,
  type ReviewScrollState,
  scrollStateWithFocus,
  splitTallThreadDelta,
} from '../../../src/core/layout/index.ts';
import {
  DOCUMENT_HEIGHT,
  geometryAt,
  measurementsAt,
  RAIL_HEIGHT,
} from '../../fixtures/layout.ts';

test('one-pixel tall-thread input preserves direction and magnitude', () => {
  const item = { height: RAIL_HEIGHT + 300, naturalTop: 12 };
  let offset = 0;
  for (let step = 0; step < 600; step += 1) {
    const transition = splitTallThreadDelta(item, 1, offset, RAIL_HEIGHT);
    assert.ok(transition.documentDelta === 0 || transition.documentDelta === 1);
    offset = transition.offset;
  }
  for (let step = 0; step < 600; step += 1) {
    const transition = splitTallThreadDelta(item, -1, offset, RAIL_HEIGHT);
    assert.ok(
      transition.documentDelta === 0 || transition.documentDelta === -1,
    );
    offset = transition.offset;
  }
});

test('a focused tall thread traverses locally before document coupling', () => {
  const tallCard = { id: 'tall', anchorTop: 12, height: RAIL_HEIGHT + 300 };
  let scrollTop = 0;
  let state: ReviewScrollState = scrollStateWithFocus(
    createScrollState(),
    tallCard.id,
  );
  const snapshot = () => {
    const next = computeExpandedSnapshot(
      measurementsAt(scrollTop, [tallCard]),
      {
        ...geometryAt(scrollTop),
        documentBottom: DOCUMENT_HEIGHT - scrollTop,
      },
      state,
    );
    state = next.state;
    return next;
  };

  let current = snapshot();
  const tallItem = current.layout.items[0];
  assert.ok(tallItem !== undefined);
  const maximumOffset = splitTallThreadDelta(
    tallItem,
    0,
    0,
    RAIL_HEIGHT,
  ).maximumOffset;
  for (let step = 0; step < maximumOffset; step += 1) {
    const transition = beginCommentLaneScroll(state, current, 1, RAIL_HEIGHT);
    assert.equal(transition.documentDelta, 0);
    state = transition.state;
    current = snapshot();
  }
  assert.equal(state.tallThreadOffsets.get(tallCard.id), maximumOffset);
  const handoff = beginCommentLaneScroll(state, current, 1, RAIL_HEIGHT);
  assert.equal(handoff.documentDelta, 1);
  scrollTop += handoff.documentDelta;
  state = handoff.state;
  const coupled = snapshot();
  assert.equal(
    coupled.layout.items[0]?.top,
    (current.layout.items[0]?.top ?? 0) - 1,
  );
});
