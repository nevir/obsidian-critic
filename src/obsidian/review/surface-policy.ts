export type VisibleReviewSurfaceMode = 'expanded' | 'sheet';
export type ReviewSurfaceMode = VisibleReviewSurfaceMode | 'hidden';

export interface VisibleRect {
  readonly top: number;
  readonly bottom: number;
}

export function chooseVisibleSurfaceMode(
  editorWidth: number,
): VisibleReviewSurfaceMode {
  return editorWidth >= 900 ? 'expanded' : 'sheet';
}

export function normalizeWheelDelta(
  deltaY: number,
  deltaMode: number,
  pageHeight: number,
): number {
  if (!Number.isFinite(deltaY)) return 0;
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * Math.max(1, pageHeight);
  return deltaY;
}

export function sheetDocumentDelta(
  anchor: VisibleRect | null,
  viewport: VisibleRect,
  sheetHeight: number,
  inset = 12,
): number {
  if (anchor === null) return 0;
  const availableTop = viewport.top + inset;
  const availableBottom = viewport.bottom - sheetHeight - inset;
  const annotationHeight = anchor.bottom - anchor.top;
  const availableHeight = availableBottom - availableTop;
  if (annotationHeight > availableHeight) {
    if (anchor.top < availableTop || anchor.top > availableBottom) {
      return anchor.top - availableTop;
    }
    return 0;
  }
  if (anchor.top < availableTop) return anchor.top - availableTop;
  if (anchor.bottom > availableBottom) {
    return anchor.bottom - availableBottom;
  }
  return 0;
}
