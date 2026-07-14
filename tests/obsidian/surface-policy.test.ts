import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseSurfaceMode,
  normalizeWheelDelta,
  sheetDocumentDelta,
} from '../../src/obsidian/review/surface-policy.ts';

test('chooses one responsive surface from stable editor width', () => {
  assert.equal(chooseSurfaceMode(1400, false), 'hidden');
  assert.equal(chooseSurfaceMode(899, true), 'sheet');
  assert.equal(chooseSurfaceMode(900, true), 'expanded');
});

test('normalizes pixel, line, and page wheel deltas', () => {
  assert.equal(normalizeWheelDelta(12, 0, 800), 12);
  assert.equal(normalizeWheelDelta(-2, 1, 800), -32);
  assert.equal(normalizeWheelDelta(1, 2, 800), 800);
  assert.equal(normalizeWheelDelta(Number.NaN, 0, 800), 0);
});

test('scrolls only enough to keep a sheet anchor visible', () => {
  const viewport = { top: 100, bottom: 900 };
  assert.equal(
    sheetDocumentDelta({ top: 80, bottom: 100 }, viewport, 260),
    -32,
  );
  assert.equal(
    sheetDocumentDelta({ top: 600, bottom: 700 }, viewport, 260),
    72,
  );
  assert.equal(sheetDocumentDelta({ top: 200, bottom: 500 }, viewport, 260), 0);
  assert.equal(sheetDocumentDelta(null, viewport, 260), 0);
});

test('does not oscillate while an annotation is taller than the available sheet viewport', () => {
  const viewport = { top: 100, bottom: 900 };
  assert.equal(sheetDocumentDelta({ top: 180, bottom: 760 }, viewport, 260), 0);
  assert.equal(
    sheetDocumentDelta({ top: 700, bottom: 1280 }, viewport, 260),
    588,
  );
  assert.equal(
    sheetDocumentDelta({ top: 60, bottom: 640 }, viewport, 260),
    -52,
  );
});
