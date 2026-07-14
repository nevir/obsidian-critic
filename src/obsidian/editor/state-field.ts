import {
  type EditorState,
  StateField,
  type Transaction,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';

import type { ParsedDocument, SourceRange } from '../../core/model';
import { parseCriticMarkup } from '../../core/syntax/index';
import { buildDecorationSpecs } from './decoration-specs';
import { createDecorationSet } from './decorations';

export interface CriticEditorSnapshot {
  readonly parsed: ParsedDocument;
  readonly decorations: DecorationSet;
  readonly livePreview: boolean;
}

export type LivePreviewReader = (state: EditorState) => boolean;

export function createCriticEditorStateField(
  readLivePreview: LivePreviewReader,
): StateField<CriticEditorSnapshot> {
  return StateField.define<CriticEditorSnapshot>({
    create: state => createSnapshot(state, readLivePreview),
    update: (snapshot, transaction) =>
      updateSnapshot(snapshot, transaction, readLivePreview),
    provide: field =>
      EditorView.decorations.from(field, snapshot => snapshot.decorations),
  });
}

function createSnapshot(
  state: EditorState,
  readLivePreview: LivePreviewReader,
): CriticEditorSnapshot {
  const parsed = parseCriticMarkup(state.doc.sliceString(0));
  return snapshotFor(parsed, state, readLivePreview);
}

function updateSnapshot(
  snapshot: CriticEditorSnapshot,
  transaction: Transaction,
  readLivePreview: LivePreviewReader,
): CriticEditorSnapshot {
  const livePreview = readLivePreview(transaction.state);
  if (
    !transaction.docChanged &&
    transaction.selection === undefined &&
    livePreview === snapshot.livePreview
  ) {
    return snapshot;
  }
  const parsed = transaction.docChanged
    ? parseCriticMarkup(transaction.state.doc.sliceString(0))
    : snapshot.parsed;
  return snapshotFor(parsed, transaction.state, readLivePreview, livePreview);
}

function snapshotFor(
  parsed: ParsedDocument,
  state: EditorState,
  readLivePreview: LivePreviewReader,
  livePreview = readLivePreview(state),
): CriticEditorSnapshot {
  return {
    parsed,
    livePreview,
    decorations: livePreview
      ? createDecorationSet(
          buildDecorationSpecs(parsed, selectionRanges(state)),
        )
      : Decoration.none,
  };
}

function selectionRanges(state: EditorState): SourceRange[] {
  return state.selection.ranges.map(range => ({
    from: range.from,
    to: range.to,
  }));
}
