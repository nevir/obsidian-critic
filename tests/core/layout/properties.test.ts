import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeExpandedSnapshot,
  createScrollState,
  focusedCardTargetTop,
  scrollStateForDocumentDelta,
  scrollStateWithFocus,
} from '../../../src/core/layout/index.ts';
import {
  feasibleFixture,
  mulberry32,
  randomFixture,
} from '../../fixtures/random-layout.ts';
import { assertLegalLayout } from './test-assertions.ts';

const EPSILON = 1e-6;

test('seeded layouts are deterministic, ordered, and finite', () => {
  const random = mulberry32(49_532);
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const fixture = randomFixture(random);
    const state = createScrollState();
    const first = computeExpandedSnapshot(
      fixture.measurements,
      fixture.geometry,
      state,
    );
    const second = computeExpandedSnapshot(
      fixture.measurements,
      fixture.geometry,
      state,
    );
    assert.deepEqual(
      second,
      first,
      `fixture ${iteration} was not deterministic`,
    );
    assertLegalLayout(first.layout, `fixture ${iteration}`);
  }
});

test('every randomly focused card lands exactly on its focus envelope', () => {
  const random = mulberry32(986_117);
  for (let iteration = 0; iteration < 120; iteration += 1) {
    const fixture = randomFixture(random, 3, 20);
    for (const candidate of fixture.measurements) {
      const state = scrollStateWithFocus(createScrollState(), candidate.id);
      const snapshot = computeExpandedSnapshot(
        fixture.measurements,
        fixture.geometry,
        state,
      );
      const focused = snapshot.layout.items.find(
        item => item.id === candidate.id,
      );
      assert.ok(focused !== undefined);
      assert.ok(
        Math.abs(
          focused.top -
            focusedCardTargetTop(focused, fixture.geometry.railHeight),
        ) <= EPSILON,
        `${iteration}/${candidate.id} missed its envelope`,
      );
      assertLegalLayout(snapshot.layout, `${iteration}/${candidate.id}`);
    }
  }
});

test('one-pixel document steps never reverse, even in impossible stacks', () => {
  const random = mulberry32(6_045_713);
  for (let iteration = 0; iteration < 300; iteration += 1) {
    const fixture = randomFixture(random);
    const { initial, moved } = onePixelStep(fixture);
    for (const [index, item] of moved.layout.items.entries()) {
      const previous = initial.layout.items[index];
      assert.ok(previous !== undefined);
      const delta = item.top - previous.top;
      assert.ok(
        delta <= EPSILON,
        `${iteration}/${item.id} reversed by ${delta}`,
      );
    }
  }
});

test('one-pixel document steps stay locally bounded in feasible notes', () => {
  const random = mulberry32(724_461);
  for (let iteration = 0; iteration < 500; iteration += 1) {
    const fixture = feasibleFixture(random);
    const { initial, moved } = onePixelStep(fixture);
    for (const [index, item] of moved.layout.items.entries()) {
      const previous = initial.layout.items[index];
      assert.ok(previous !== undefined);
      const delta = item.top - previous.top;
      assert.ok(
        delta <= EPSILON,
        `${iteration}/${item.id} reversed by ${delta}`,
      );
      assert.ok(
        Math.abs(delta) <= 4 + EPSILON,
        `${iteration}/${item.id} jumped by ${delta}`,
      );
    }
  }
});

function onePixelStep(fixture: ReturnType<typeof randomFixture>) {
  const initial = computeExpandedSnapshot(
    fixture.measurements,
    fixture.geometry,
    createScrollState(),
  );
  const measurements = fixture.measurements.map(item => ({
    ...item,
    naturalTop: item.naturalTop - 1,
    anchorRect: {
      top: item.anchorRect.top - 1,
      bottom: item.anchorRect.bottom - 1,
    },
  }));
  const moved = computeExpandedSnapshot(
    measurements,
    {
      ...fixture.geometry,
      documentTop: fixture.geometry.documentTop - 1,
      documentBottom: fixture.geometry.documentBottom - 1,
    },
    scrollStateForDocumentDelta(initial.state, 1),
    { scrollMoved: true },
  );
  return { initial, moved };
}
