import assert from 'node:assert/strict';
import test from 'node:test';

import type { Decoration } from '@codemirror/view';

import { createDecorationSet } from '../../src/obsidian/editor/decorations.ts';

test('maps plain descriptions to sorted CodeMirror decorations', () => {
  const decorations = createDecorationSet([
    {
      kind: 'widget',
      at: 12,
      reviewId: 'point',
      role: 'point',
    },
    { kind: 'replace', from: 0, to: 3 },
    {
      kind: 'mark',
      from: 3,
      to: 7,
      annotationClass: 'addition',
      reviewId: 'change',
    },
    { kind: 'separator', from: 8, to: 10 },
    {
      kind: 'syntax',
      from: 14,
      to: 16,
      reviewId: 'expanded',
      text: '==',
      placement: 'after',
    },
  ]);
  const ranges: Array<{
    readonly from: number;
    readonly to: number;
    readonly decoration: Decoration;
  }> = [];
  decorations.between(0, 20, (from, to, decoration) => {
    ranges.push({ from, to, decoration });
  });

  assert.deepEqual(
    ranges.map(({ from, to }) => ({ from, to })),
    [
      { from: 0, to: 3 },
      { from: 3, to: 7 },
      { from: 8, to: 10 },
      { from: 12, to: 12 },
      { from: 14, to: 16 },
      { from: 16, to: 16 },
    ],
  );
  const change = ranges[1];
  assert.ok(change);
  assert.equal(
    change.decoration.spec.attributes['data-critic-review-id'],
    'change',
  );
  assert.match(change.decoration.spec.class, /critic-annotation-addition/u);

  for (const index of [3, 5]) {
    const widget = ranges[index]?.decoration.spec.widget;
    assert.ok(widget);
    assert.equal(widget.ignoreEvent(new Event('mousedown')), false);
  }
});
