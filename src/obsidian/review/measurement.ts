import type { EditorView } from '@codemirror/view';

import type {
  LayoutGeometry,
  LayoutMeasurement,
} from '../../core/layout/index';
import type { ReviewItem } from '../../core/model';
import type { ReviewRail } from './rail';
import type { VisibleRect } from './surface-policy';

export interface ExpandedMeasurement {
  readonly items: readonly LayoutMeasurement[];
  readonly geometry: LayoutGeometry;
}

export interface SheetMeasurement {
  readonly anchor: VisibleRect | null;
  readonly viewport: VisibleRect;
  readonly sheetHeight: number;
}

export function measureExpandedSurface(
  view: EditorView,
  rail: ReviewRail,
  reviews: readonly ReviewItem[],
): ExpandedMeasurement {
  const railRect = rail.element.getBoundingClientRect();
  const visibleAnchors = visibleAnnotationRects(view);
  const items: LayoutMeasurement[] = [];
  for (const review of reviews) {
    const card = rail.cardElement(review.id);
    if (card === null) continue;
    const anchorRect = measureAnchor(
      view,
      review,
      railRect.top,
      visibleAnchors,
    );
    items.push({
      id: review.id,
      naturalTop: anchorRect.top,
      height: Math.max(1, card.offsetHeight),
      anchorRect,
    });
  }
  const documentTop = view.documentTop - railRect.top;
  return {
    items,
    geometry: {
      railHeight: rail.element.clientHeight,
      documentTop,
      documentBottom: documentTop + view.contentHeight,
    },
  };
}

export function measureSheetSurface(
  view: EditorView,
  review: ReviewItem | null,
  sheet: HTMLElement,
): SheetMeasurement {
  const viewport = view.scrollDOM.getBoundingClientRect();
  const visibleAnchors = visibleAnnotationRects(view);
  return {
    anchor:
      review === null ? null : measureAnchor(view, review, 0, visibleAnchors),
    viewport: { top: viewport.top, bottom: viewport.bottom },
    sheetHeight: sheet.offsetHeight,
  };
}

function measureAnchor(
  view: EditorView,
  review: ReviewItem,
  originTop: number,
  visibleAnchors: ReadonlyMap<string, DOMRect>,
): VisibleRect {
  const visible = visibleAnchors.get(review.id);
  if (visible !== undefined) {
    return {
      top: visible.top - originTop,
      bottom: visible.bottom - originTop,
    };
  }
  const position = Math.min(review.anchor.from, view.state.doc.length);
  const block = view.lineBlockAt(position);
  const top = view.documentTop + block.top - originTop;
  return { top, bottom: top + Math.max(1, block.height) };
}

function visibleAnnotationRects(view: EditorView): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const element of view.dom.querySelectorAll<HTMLElement>(
    '.critic-annotation, .critic-inline-anchor',
  )) {
    const reviewId = element.dataset['criticReviewId'];
    if (reviewId === undefined || rects.has(reviewId)) continue;
    for (const rect of element.getClientRects()) {
      if (rect.height <= 0) continue;
      rects.set(reviewId, rect);
      break;
    }
  }
  return rects;
}
