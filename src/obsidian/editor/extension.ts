import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

import type { CriticEditorHost } from './host';
import { criticEditorStateField } from './live-preview-state';
import { CriticEditorSession } from './session';

const criticEditorPlugin = ViewPlugin.fromClass<
  CriticEditorSession,
  CriticEditorHost
>(CriticEditorSession, {
  eventHandlers: {
    mousedown(event) {
      this.handleMouseDown(event);
      return false;
    },
    keydown(event) {
      return this.handleKeydown(event);
    },
  },
  provide: plugin =>
    EditorView.editorAttributes.of(
      view => view.plugin(plugin)?.rootAttributes ?? null,
    ),
});

export function createCriticEditorExtension(host: CriticEditorHost): Extension {
  return [criticEditorStateField, criticEditorPlugin.of(host)];
}
