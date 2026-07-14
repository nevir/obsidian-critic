import assert from 'node:assert/strict';
import test from 'node:test';

import { EditorState } from '@codemirror/state';
import {
  type Decoration,
  type DecorationSet,
  EditorView,
} from '@codemirror/view';

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
    hasDecorationClass(
      selected.field(criticEditorStateField).decorations,
      'critic-annotation-expanded',
    ),
    true,
  );
  assert.equal(
    hasDecorationClass(
      state.field(criticEditorStateField).decorations,
      'critic-annotation-expanded',
    ),
    false,
  );
  assert.equal(
    edited.field(criticEditorStateField).parsed.source,
    edited.doc.toString(),
  );
});

test('preserves the last mode when the host Live Preview field is unavailable', () => {
  let hostMode: boolean | undefined;
  const field = createCriticEditorStateField(() => hostMode, {
    initialLivePreview: true,
  });
  const initial = EditorState.create({
    doc: '{++text++}',
    extensions: [field],
  });

  assert.equal(initial.field(field).livePreview, true);
  assert.notEqual(initial.field(field).decorations.size, 0);

  const unavailable = initial.update({ selection: { anchor: 1 } }).state;
  assert.equal(unavailable.field(field).livePreview, true);

  hostMode = false;
  const sourceMode = unavailable.update({ selection: { anchor: 2 } }).state;
  assert.equal(sourceMode.field(field).livePreview, false);
  assert.equal(sourceMode.field(field).decorations.size, 0);

  hostMode = undefined;
  const stillSourceMode = sourceMode.update({ selection: { anchor: 3 } }).state;
  assert.equal(stillSourceMode.field(field).livePreview, false);
});

function livePreviewState(source: string): EditorState {
  return EditorState.create({
    doc: source,
    selection: { anchor: 0 },
    extensions: [criticEditorStateField],
  });
}

function hasDecorationClass(decorations: DecorationSet, className: string) {
  let found = false;
  decorations.between(0, Number.POSITIVE_INFINITY, (_from, _to, decoration) => {
    if (decoration.spec.class?.includes(className)) found = true;
  });
  return found;
}
