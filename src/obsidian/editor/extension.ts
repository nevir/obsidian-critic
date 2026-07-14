import type { Extension } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';

import type { CriticEditorHost } from './host';
import { criticEditorStateField } from './live-preview-state';
import { CriticEditorSession } from './session';

const criticEditorPlugin = ViewPlugin.fromClass<
  CriticEditorSession,
  CriticEditorHost
>(CriticEditorSession, {
  eventHandlers: {
    click(event) {
      this.handleClick(event);
      return false;
    },
    keydown(event) {
      return this.handleKeydown(event);
    },
  },
});

export function createCriticEditorExtension(host: CriticEditorHost): Extension {
  return [criticEditorStateField, criticEditorPlugin.of(host)];
}
