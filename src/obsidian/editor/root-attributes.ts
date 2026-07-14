import type { VisibleReviewSurfaceMode } from '../review/surface-policy';

export function criticEditorRootAttributes(
  reviewing: boolean,
  mode: VisibleReviewSurfaceMode,
): { readonly class: string } | null {
  if (!reviewing) return null;
  const modeClass =
    mode === 'expanded' ? 'critic-expanded' : 'critic-sheet-mode';
  return {
    class: `critic-editor critic-live-preview ${modeClass}`,
  };
}
