import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readSourceMode,
  resolveLivePreviewMode,
} from '../../src/obsidian/editor/live-preview-mode.ts';

test('reads persisted mode from Markdown view-compatible hosts', () => {
  assert.equal(readSourceMode({ getState: () => ({ source: false }) }), false);
  assert.equal(readSourceMode({ getState: () => ({ source: true }) }), true);
  assert.equal(readSourceMode({}), undefined);
});

test('keeps Live Preview active when only the focus-sensitive field clears', () => {
  assert.equal(resolveLivePreviewMode(false, false), true);
});

test('treats persisted Source mode as authoritative', () => {
  assert.equal(resolveLivePreviewMode(true, true), false);
});

test('falls back to the editor field outside a Markdown view', () => {
  assert.equal(resolveLivePreviewMode(undefined, true), true);
  assert.equal(resolveLivePreviewMode(undefined, false), false);
  assert.equal(resolveLivePreviewMode(undefined, undefined), undefined);
});
