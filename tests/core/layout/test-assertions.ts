import assert from 'node:assert/strict';

import {
  CARD_GAP,
  type ExpandedLayout,
} from '../../../src/core/layout/index.ts';

const EPSILON = 1e-6;

export function assertLegalLayout(
  layout: ExpandedLayout,
  context: string,
): void {
  for (let index = 1; index < layout.items.length; index += 1) {
    const previous = layout.items[index - 1];
    const current = layout.items[index];
    assert.ok(previous !== undefined && current !== undefined);
    assert.ok(
      current.top >= previous.top + previous.height + CARD_GAP - EPSILON,
      `${context}: ${previous.id}/${current.id} overlap`,
    );
  }
  for (const item of layout.items) {
    assert.ok(
      Number.isFinite(item.top),
      `${context}: ${item.id} is not finite`,
    );
  }
}
