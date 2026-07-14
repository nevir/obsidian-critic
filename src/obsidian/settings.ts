import type { ReviewProjection } from '../core/projection';

export interface CriticSettings {
  readonly readingProjection: ReviewProjection;
}

export const DEFAULT_CRITIC_SETTINGS: CriticSettings = {
  readingProjection: 'original',
};

export function normalizeCriticSettings(value: unknown): CriticSettings {
  if (!isRecord(value)) return { ...DEFAULT_CRITIC_SETTINGS };
  return {
    readingProjection:
      value['readingProjection'] === 'proposed' ? 'proposed' : 'original',
  };
}

export function settingsErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? `: ${error.message}` : '';
  return `Critic could not save its Reading View setting${detail}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
