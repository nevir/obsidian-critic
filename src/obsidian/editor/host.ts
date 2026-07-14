import type * as obsidian from 'obsidian';

import type { CriticEditorSession } from './session';

export interface CriticEditorHost {
  readonly app: obsidian.App;
  readonly attachSession: (session: CriticEditorSession) => void;
  readonly detachSession: (session: CriticEditorSession) => void;
}
