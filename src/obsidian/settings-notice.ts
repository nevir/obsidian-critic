import { Notice } from 'obsidian';

import { settingsErrorMessage } from './settings';

export function showSettingsError(error: unknown): Notice {
  return new Notice(settingsErrorMessage(error));
}
