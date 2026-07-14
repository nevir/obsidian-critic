import { editorInfoField, editorLivePreviewField } from 'obsidian';
import { readSourceMode, resolveLivePreviewMode } from './live-preview-mode';
import { createCriticEditorStateField } from './state-field';

export const criticEditorStateField = createCriticEditorStateField(
  state => {
    const editorInfo = state.field(editorInfoField, false);
    return resolveLivePreviewMode(
      readSourceMode(editorInfo),
      state.field(editorLivePreviewField, false),
    );
  },
  // Obsidian may install editor extensions before this host field on startup.
  { initialLivePreview: true },
);
