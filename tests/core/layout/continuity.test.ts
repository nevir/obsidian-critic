import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginCommentLaneScroll,
  clamp,
  computeExpandedSnapshot,
  createScrollState,
  type ExpandedLayout,
  finishCommentLaneScroll,
  focusedCardTargetTop,
  type ReviewScrollState,
  scrollStateForDocumentDelta,
  scrollStateWithFocus,
} from '../../../src/core/layout/index.ts';
import {
  exampleCards,
  geometryAt,
  MAX_SCROLL_TOP,
  measurementsAt,
  RAIL_HEIGHT,
} from '../../fixtures/layout.ts';
import { assertLegalLayout } from './test-assertions.ts';

const MAX_CARD_DELTA_PER_PIXEL = 4;
const EPSILON = 1e-6;

interface Harness {
  scrollTop: number;
  scrollState: ReviewScrollState;
}

function createHarness(focusedReviewId: string | null): {
  readonly harness: Harness;
  readonly layout: ExpandedLayout;
} {
  const focusCard = focusedReviewId
    ? exampleCards.find(card => card.id === focusedReviewId)
    : undefined;
  const scrollTop = focusCard
    ? Math.round(
        clamp(focusCard.anchorTop - RAIL_HEIGHT * 0.35, 0, MAX_SCROLL_TOP),
      )
    : 0;
  const harness: Harness = {
    scrollTop,
    scrollState: focusedReviewId
      ? scrollStateWithFocus(createScrollState(), focusedReviewId)
      : createScrollState(),
  };
  return { harness, layout: compute(harness, false) };
}

function compute(harness: Harness, scrollMoved: boolean): ExpandedLayout {
  const snapshot = computeExpandedSnapshot(
    measurementsAt(harness.scrollTop),
    geometryAt(harness.scrollTop),
    harness.scrollState,
    { scrollMoved },
  );
  harness.scrollState = snapshot.state;

  if (harness.scrollState.focusedReviewId !== null) {
    const focused = snapshot.layout.items.find(
      item => item.id === harness.scrollState.focusedReviewId,
    );
    const tallOffset =
      harness.scrollState.tallThreadOffsets.get(
        harness.scrollState.focusedReviewId,
      ) ?? 0;
    assert.ok(focused !== undefined);
    assert.ok(
      Math.abs(
        focused.top - focusedCardTargetTop(focused, RAIL_HEIGHT, tallOffset),
      ) <= EPSILON,
      `${focused.id} left its focus envelope`,
    );
  }
  return snapshot.layout;
}

function assertContinuous(
  previous: ExpandedLayout,
  current: ExpandedLayout,
  direction: number,
  context: string,
): void {
  assertLegalLayout(current, context);
  for (const [index, item] of current.items.entries()) {
    const oldItem = previous.items[index];
    assert.ok(oldItem !== undefined);
    const delta = item.top - oldItem.top;
    const handoff = `${driverId(previous)}->${driverId(current)}`;
    assert.ok(
      direction * delta <= EPSILON,
      `${context}: ${item.id} reversed ${delta}px (${handoff})`,
    );
    assert.ok(
      Math.abs(delta) <= MAX_CARD_DELTA_PER_PIXEL + EPSILON,
      `${context}: ${item.id} jumped ${delta}px (${handoff})`,
    );
  }
}

function documentStep(
  harness: Harness,
  previous: ExpandedLayout,
  direction: number,
): ExpandedLayout {
  const next = clamp(harness.scrollTop + direction, 0, MAX_SCROLL_TOP);
  const moved = next !== harness.scrollTop;
  harness.scrollTop = next;
  if (moved) {
    harness.scrollState = scrollStateForDocumentDelta(
      harness.scrollState,
      direction,
    );
  }
  const layout = compute(harness, moved);
  if (moved) {
    assertContinuous(previous, layout, direction, `document at ${next}`);
  }
  const settled = compute(harness, false);
  assert.deepEqual(
    settled.items.map(item => item.top),
    layout.items.map(item => item.top),
    `no-motion layout changed at ${next}`,
  );
  assert.equal(driverId(settled), driverId(layout));
  return settled;
}

function commentStep(
  harness: Harness,
  previous: ExpandedLayout,
  direction: number,
): ExpandedLayout {
  const transition = beginCommentLaneScroll(
    harness.scrollState,
    { layout: previous },
    direction,
    RAIL_HEIGHT,
  );
  harness.scrollState = transition.state;
  const next = clamp(
    harness.scrollTop + transition.documentDelta,
    0,
    MAX_SCROLL_TOP,
  );
  const documentDelta = next - harness.scrollTop;
  assert.ok(Math.abs(documentDelta) <= 1 + EPSILON);
  assert.ok(direction * documentDelta >= -EPSILON);
  harness.scrollTop = next;
  if (documentDelta !== 0) {
    harness.scrollState = scrollStateForDocumentDelta(
      harness.scrollState,
      Math.sign(documentDelta),
    );
  }
  let layout = compute(harness, documentDelta !== 0);
  const progress = transition.needsCollisionProgress
    ? finishCommentLaneScroll(harness.scrollState, { layout }, direction)
    : { state: harness.scrollState, changed: false };
  harness.scrollState = progress.state;
  if (progress.changed) layout = compute(harness, false);
  assertContinuous(previous, layout, direction, `comments at ${next}`);
  return layout;
}

function sweep(
  focusedReviewId: string | null,
  step: (
    harness: Harness,
    previous: ExpandedLayout,
    direction: number,
  ) => ExpandedLayout,
): void {
  const { harness, layout: initial } = createHarness(focusedReviewId);
  assertLegalLayout(initial, `initial ${focusedReviewId ?? 'unfocused'}`);
  let layout = initial;
  while (harness.scrollTop < MAX_SCROLL_TOP) {
    layout = step(harness, layout, 1);
  }
  while (harness.scrollTop > 0) layout = step(harness, layout, -1);
}

function driverId(layout: ExpandedLayout): string | null {
  return layout.items[layout.pivotIndex]?.id ?? null;
}

for (const focus of [null, ...exampleCards.map(card => card.id)]) {
  const focusName = focus ?? 'unfocused';
  test(`document scrolling is continuous: ${focusName}`, () =>
    sweep(focus, documentStep));
  test(`comment-lane scrolling is continuous: ${focusName}`, () =>
    sweep(focus, commentStep));

  for (const [name, step] of [
    ['document', documentStep],
    ['comments', commentStep],
  ] as const) {
    test(`direction reversals remain continuous: ${focusName} ${name}`, () => {
      const { harness, layout: initial } = createHarness(focus);
      let layout = initial;
      const start = harness.scrollTop;
      const targets = [
        clamp(start + 240, 0, MAX_SCROLL_TOP),
        clamp(start - 120, 0, MAX_SCROLL_TOP),
        clamp(start + 620, 0, MAX_SCROLL_TOP),
        clamp(start + 80, 0, MAX_SCROLL_TOP),
        clamp(start + 900, 0, MAX_SCROLL_TOP),
        clamp(start - 40, 0, MAX_SCROLL_TOP),
      ];
      for (const target of targets) {
        const direction = Math.sign(target - harness.scrollTop);
        while (harness.scrollTop !== target) {
          layout = step(harness, layout, direction);
        }
      }
    });
  }
}
