import { editorLivePreviewField } from 'obsidian';

import { createCriticEditorStateField } from './state-field';

export const criticEditorStateField = createCriticEditorStateField(
  state => state.field(editorLivePreviewField, false) ?? false,
);
