import * as obsidian from 'obsidian';

import type { Plugin } from './Plugin';

export class SettingsTab extends obsidian.PluginSettingTab {
  constructor(
    app: obsidian.App,
    private readonly plugin: Plugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    const { settings } = this.plugin;
    containerEl.empty();

    new obsidian.Setting(containerEl)
      .setName(`Thingy`)
      .setDesc(`It does a thingy`)
      .addText(text =>
        text.setValue(settings.thingy ?? '').onChange(async value => {
          await this.plugin.setSetting(
            'thingy',
            value.trim() === '' ? undefined : value,
          );
        }),
      );

    new obsidian.Setting(containerEl)
      .setName(`Required`)
      .setDesc(`What's your favorite number?`)
      .addSlider(slider =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.settings.required)
          .onChange(async value => {
            await this.plugin.setSetting('required', value);
          }),
      );
  }
}
