import type { App } from 'obsidian';

export interface CriticEditorHost {
  readonly app: App;
  readonly statusBarContainer: HTMLElement | null;
}
