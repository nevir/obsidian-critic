import * as obsidian from 'obsidian';

import { createCriticEditorExtension } from './editor/extension';
import type { CriticEditorHost } from './editor/host';
import type { CriticEditorSession } from './editor/session';

export class CriticPlugin extends obsidian.Plugin implements CriticEditorHost {
  private readonly sessions = new Set<CriticEditorSession>();

  override onload(): void {
    this.registerEditorExtension(createCriticEditorExtension(this));
  }

  attachSession(session: CriticEditorSession): void {
    this.sessions.add(session);
  }

  detachSession(session: CriticEditorSession): void {
    this.sessions.delete(session);
  }
}
