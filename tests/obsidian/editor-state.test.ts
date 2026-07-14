import assert from 'node:assert/strict';
import test from 'node:test';

import { EditorState } from '@codemirror/state';
import { type Decoration, EditorView } from '@codemirror/view';

import { createCriticEditorStateField } from '../../src/obsidian/editor/state-field.ts';

const criticEditorStateField = createCriticEditorStateField(() => true);

test('provides multiline replacements directly from editor state', () => {
  const source = 'intro\n\n{==text==}{>>[Ian]\nfirst line\nsecond line\n<<}';
  const state = livePreviewState(source);
  const snapshot = state.field(criticEditorStateField);
  const ranges: Array<{
    readonly from: number;
    readonly to: number;
    readonly decoration: Decoration;
  }> = [];
  snapshot.decorations.between(0, source.length, (from, to, decoration) => {
    ranges.push({ from, to, decoration });
  });

  assert.equal(
    ranges.some(
      range =>
        range.decoration.spec.class === undefined &&
        source.slice(range.from, range.to).includes('\n'),
    ),
    true,
  );
  assert.equal(
    state
      .facet(EditorView.decorations)
      .some(provider => typeof provider === 'function'),
    false,
  );
});

test('recomputes direct decorations for selections and document changes', () => {
  const source = 'intro\n\n{==text==}{>>multiline\ncomment<<}';
  const state = livePreviewState(source);
  const selected = state.update({
    selection: { anchor: source.indexOf('comment') },
  }).state;
  const edited = selected.update({
    changes: { from: 3, to: 7, insert: 'updated' },
  }).state;

  assert.equal(
    selected.field(criticEditorStateField).decorations.size <
      state.field(criticEditorStateField).decorations.size,
    true,
  );
  assert.equal(
    edited.field(criticEditorStateField).parsed.source,
    edited.doc.toString(),
  );
});

function livePreviewState(source: string): EditorState {
  return EditorState.create({
    doc: source,
    selection: { anchor: 0 },
    extensions: [criticEditorStateField],
  });
}
