import { editorLivePreviewField } from 'obsidian';

import { createCriticEditorStateField } from './state-field';

export const criticEditorStateField = createCriticEditorStateField(
  state => state.field(editorLivePreviewField, false),
  // Obsidian may install editor extensions before this host field on startup.
  { initialLivePreview: true },
);
