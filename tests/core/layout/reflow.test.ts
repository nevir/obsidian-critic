import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeExpandedSnapshot,
  createScrollState,
} from '../../../src/core/layout/index.ts';
import {
  integer,
  makeMeasurement,
  mulberry32,
  randomFixture,
} from '../../fixtures/random-layout.ts';
import { assertLegalLayout } from './test-assertions.ts';

const EPSILON = 1e-6;

test('card-height and viewport reflow always preserves the legal stack', () => {
  const random = mulberry32(20_965);
  for (let iteration = 0; iteration < 300; iteration += 1) {
    const fixture = randomFixture(random);
    const changed = fixture.measurements.map(item => ({
      ...item,
      height: Math.max(24, item.height + integer(random, -120, 180)),
    }));
    const geometry = {
      ...fixture.geometry,
      railHeight: Math.max(
        240,
        fixture.geometry.railHeight + integer(random, -180, 180),
      ),
    };
    const layout = computeExpandedSnapshot(
      changed,
      geometry,
      createScrollState(),
    ).layout;
    assertLegalLayout(layout, `reflow ${iteration}`);
  }
});

test('document endpoint bounds hold whenever the full stack fits', () => {
  const measurements = [
    makeMeasurement('first', 20, 80),
    makeMeasurement('middle', 180, 90),
    makeMeasurement('last', 420, 100),
  ];
  const railHeight = 600;
  const documentHeight = 1500;
  const top = computeExpandedSnapshot(
    measurements,
    { railHeight, documentTop: 0, documentBottom: documentHeight },
    createScrollState(),
  ).layout;
  assert.ok((top.items[0]?.top ?? -1) >= -EPSILON);

  const scrollTop = documentHeight - railHeight;
  const bottomMeasurements = measurements.map(item => ({
    ...item,
    naturalTop: item.naturalTop - scrollTop,
    anchorRect: {
      top: item.anchorRect.top - scrollTop,
      bottom: item.anchorRect.bottom - scrollTop,
    },
  }));
  const bottom = computeExpandedSnapshot(
    bottomMeasurements,
    { railHeight, documentTop: -scrollTop, documentBottom: railHeight },
    createScrollState(),
  ).layout;
  const last = bottom.items[bottom.items.length - 1];
  assert.ok(
    last !== undefined && last.top + last.height <= railHeight + EPSILON,
  );
});

test('empty and singleton layouts have explicit stable behavior', () => {
  const geometry = { railHeight: 600, documentTop: 0, documentBottom: 1000 };
  const empty = computeExpandedSnapshot([], geometry, createScrollState());
  assert.deepEqual(empty.layout, {
    items: [],
    pivotIndex: -1,
    sharedAnchorId: null,
    layoutAnchorId: null,
    absorbedCollisionKeys: [],
  });

  const singleton = computeExpandedSnapshot(
    [makeMeasurement('only', 100, 120)],
    geometry,
    createScrollState(),
  );
  assert.equal(singleton.layout.items[0]?.top, 100);
  assert.equal(singleton.layout.sharedAnchorId, 'only');
});
