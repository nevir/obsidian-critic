import assert from 'node:assert/strict';
import test from 'node:test';

import { criticEditorRootAttributes } from '../../src/obsidian/editor/root-attributes.ts';

test('provides complete root classes only while reviews are visible', () => {
  assert.equal(criticEditorRootAttributes(false, 'expanded'), null);
  assert.deepEqual(criticEditorRootAttributes(true, 'expanded'), {
    class: 'critic-editor critic-live-preview critic-expanded',
  });
  assert.deepEqual(criticEditorRootAttributes(true, 'sheet'), {
    class: 'critic-editor critic-live-preview critic-sheet-mode',
  });
});
