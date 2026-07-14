import * as obsidian from 'obsidian';

import type { ReviewProjection } from '../core/projection';
import type { CriticSettings } from './settings';
import { showSettingsError } from './settings-notice';

export interface CriticSettingsController {
  readonly settings: CriticSettings;
  readonly setReadingProjection: (
    projection: ReviewProjection,
  ) => Promise<void>;
}

export class CriticSettingsTab extends obsidian.PluginSettingTab {
  constructor(
    app: obsidian.App,
    plugin: obsidian.Plugin,
    private readonly controller: CriticSettingsController,
  ) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    new obsidian.Setting(this.containerEl)
      .setName('Reading View')
      .setDesc('Show the original text or the proposed result in every note.')
      .addDropdown(dropdown => {
        dropdown
          .addOption('original', 'Original')
          .addOption('proposed', 'Proposed')
          .setValue(this.controller.settings.readingProjection)
          .onChange(async value => {
            const projection = readingProjection(value);
            try {
              await this.controller.setReadingProjection(projection);
            } catch (error) {
              showSettingsError(error);
              this.display();
            }
          });
      });
  }
}

function readingProjection(value: string): ReviewProjection {
  return value === 'proposed' ? 'proposed' : 'original';
}
