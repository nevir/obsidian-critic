import * as obsidian from 'obsidian';

import type { ReviewProjection } from '../core/projection';
import { createCriticEditorExtension } from './editor/extension';
import type { CriticEditorHost } from './editor/host';
import { createReadingPostProcessor } from './reading/postprocessor';
import {
  type CriticSettings,
  DEFAULT_CRITIC_SETTINGS,
  normalizeCriticSettings,
} from './settings';
import { CriticSettingsTab } from './settings-tab';

const FINAL_RUNNABLE_POSTPROCESSOR_ORDER = Number.MAX_SAFE_INTEGER - 1;

export class CriticPlugin extends obsidian.Plugin implements CriticEditorHost {
  private statusBarProbe: HTMLElement | null = null;
  settings: CriticSettings = DEFAULT_CRITIC_SETTINGS;
  private settingsRevision = 0;
  private settingsSaveQueue: Promise<void> = Promise.resolve();

  override async onload(): Promise<void> {
    this.settings = normalizeCriticSettings(await this.loadData());
    // A hidden item is the supported handle for locating Obsidian's host-owned
    // status bar; review surfaces use its container as their bottom boundary.
    this.statusBarProbe = this.addStatusBarItem();
    this.statusBarProbe.style.display = 'none';
    this.registerEditorExtension(createCriticEditorExtension(this));
    this.registerMarkdownPostProcessor(
      createReadingPostProcessor(
        this.app,
        () => this.settings.readingProjection,
      ),
      FINAL_RUNNABLE_POSTPROCESSOR_ORDER,
    );
    this.addSettingTab(new CriticSettingsTab(this.app, this, this));
    this.app.workspace.onLayoutReady(() => this.rerenderReadingViews());
    this.addCommand({
      id: 'toggle-reading-view-projection',
      name: 'Toggle Reading View projection',
      callback: async () => {
        const projection =
          this.settings.readingProjection === 'original'
            ? 'proposed'
            : 'original';
        try {
          await this.setReadingProjection(projection);
          showProjectionChanged(projection);
        } catch (error) {
          showSettingsError(error);
        }
      },
    });
  }

  get statusBarContainer(): HTMLElement | null {
    return this.statusBarProbe?.parentElement ?? null;
  }

  setReadingProjection(projection: ReviewProjection): Promise<void> {
    if (projection === this.settings.readingProjection) {
      return this.settingsSaveQueue;
    }
    const previous = this.settings;
    const next = { ...previous, readingProjection: projection };
    this.settingsRevision += 1;
    const revision = this.settingsRevision;
    this.settings = next;

    const save = this.settingsSaveQueue.then(() => this.saveData(next));
    this.settingsSaveQueue = save.catch(() => undefined);
    return save
      .then(() => {
        if (this.settingsRevision === revision) this.rerenderReadingViews();
      })
      .catch(error => {
        if (this.settingsRevision === revision) this.settings = previous;
        throw error;
      });
  }

  private rerenderReadingViews(): void {
    this.app.workspace.iterateAllLeaves(leaf => {
      if (
        leaf.view instanceof obsidian.MarkdownView &&
        leaf.view.getMode() === 'preview'
      ) {
        leaf.view.previewMode.rerender(true);
      }
    });
  }
}

function settingsError(error: unknown): string {
  const detail = error instanceof Error ? `: ${error.message}` : '';
  return `Critic could not save its Reading View setting${detail}`;
}

function showSettingsError(error: unknown): obsidian.Notice {
  return new obsidian.Notice(settingsError(error));
}

function showProjectionChanged(projection: ReviewProjection): obsidian.Notice {
  const label = projection === 'original' ? 'Original' : 'Proposed';
  return new obsidian.Notice(`Reading View now shows ${label} text`);
}
