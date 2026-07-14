import type { EditorView } from '@codemirror/view';
import type { App } from 'obsidian';

import {
  beginCommentLaneScroll,
  computeExpandedSnapshot,
  createScrollState,
  type ExpandedSnapshot,
  finishCommentLaneScroll,
  type ReviewScrollState,
  scrollStateForDocumentDelta,
  scrollStateWithFocus,
  scrollStateWithoutFocus,
} from '../../core/layout/index';
import type { ReviewItem } from '../../core/model';
import type { ReviewCardCallbacks } from './card';
import {
  type ExpandedMeasurement,
  measureExpandedSurface,
  measureSheetSurface,
  type SheetMeasurement,
} from './measurement';
import type { ReviewPresentation } from './presentation';
import { ReviewRail } from './rail';
import { ReviewSheet } from './sheet';
import {
  chooseVisibleSurfaceMode,
  normalizeWheelDelta,
  type ReviewSurfaceMode,
  sheetDocumentDelta,
  type VisibleReviewSurfaceMode,
} from './surface-policy';

type SurfaceMeasurement =
  | { readonly mode: 'hidden' }
  | {
      readonly mode: 'expanded';
      readonly surface: ExpandedMeasurement;
      readonly documentDelta: number;
      readonly collisionDelta: number;
    }
  | {
      readonly mode: 'sheet';
      readonly surface: SheetMeasurement;
      readonly documentDelta: number;
    };

export class ReviewSurfaceController {
  private readonly rail: ReviewRail;
  private readonly sheet: ReviewSheet;
  private readonly editorResizeObserver: ResizeObserver;
  private reviews: readonly ReviewItem[] = [];
  private presentations: readonly ReviewPresentation[] = [];
  private focusedReviewId: string | null = null;
  private readonly lifecycle: {
    reviewing: boolean;
    destroyed: boolean;
  } = { reviewing: false, destroyed: false };
  private mode: VisibleReviewSurfaceMode = 'sheet';
  private scrollState: ReviewScrollState = createScrollState();
  private snapshot: ExpandedSnapshot | null = null;
  private previousScrollTop: number;
  private pendingDocumentDelta = 0;
  private pendingCollisionDelta = 0;

  constructor(
    private readonly view: EditorView,
    app: App,
    callbacks: ReviewCardCallbacks,
  ) {
    this.rail = new ReviewRail(view.dom, app, callbacks, this.schedule);
    this.sheet = new ReviewSheet(view.dom, app, callbacks, this.schedule);
    this.previousScrollTop = view.scrollDOM.scrollTop;
    this.editorResizeObserver = new ResizeObserver(this.handleEditorResize);
    this.editorResizeObserver.observe(view.dom);
    view.scrollDOM.addEventListener('scroll', this.handleDocumentScroll, {
      passive: true,
    });
    this.rail.element.addEventListener('wheel', this.handleRailWheel, {
      passive: false,
    });
  }

  get presentationMode(): VisibleReviewSurfaceMode {
    return this.mode;
  }

  reconcile(
    reviews: readonly ReviewItem[],
    presentations: readonly ReviewPresentation[],
    focusedReviewId: string | null,
    sourcePath: string,
    reviewing: boolean,
  ): void {
    this.reviews = reviews;
    this.presentations = presentations;
    this.lifecycle.reviewing = reviewing;
    if (!reviewing) {
      this.pendingDocumentDelta = 0;
      this.pendingCollisionDelta = 0;
    }
    this.rail.reconcile(reviewing ? presentations : [], sourcePath);
    this.setFocus(focusedReviewId, sourcePath);
    this.schedule();
  }

  setFocus(focusedReviewId: string | null, sourcePath: string): void {
    const focusChanged = focusedReviewId !== this.focusedReviewId;
    this.focusedReviewId = focusedReviewId;
    this.rail.setFocused(focusedReviewId);
    const index = this.presentations.findIndex(
      presentation => presentation.id === focusedReviewId,
    );
    this.sheet.show(
      this.lifecycle.reviewing && index >= 0
        ? (this.presentations[index] ?? null)
        : null,
      Math.max(0, index),
      this.presentations.length,
      sourcePath,
    );
    if (focusChanged) {
      this.scrollState =
        focusedReviewId === null
          ? scrollStateWithoutFocus(this.scrollState)
          : scrollStateWithFocus(this.scrollState, focusedReviewId);
    }
    this.schedule();
  }

  readonly schedule = (): void => {
    if (this.lifecycle.destroyed) return;
    this.view.requestMeasure({
      key: this,
      read: () => this.readMeasurement(),
      write: measurement => this.commitMeasurement(measurement),
    });
  };

  destroy(): void {
    this.lifecycle.destroyed = true;
    this.editorResizeObserver.disconnect();
    this.view.scrollDOM.removeEventListener(
      'scroll',
      this.handleDocumentScroll,
    );
    this.rail.element.removeEventListener('wheel', this.handleRailWheel);
    this.rail.destroy();
    this.sheet.destroy();
  }

  private readMeasurement(): SurfaceMeasurement {
    const mode: ReviewSurfaceMode = this.lifecycle.reviewing
      ? this.mode
      : 'hidden';
    if (mode === 'hidden') return { mode };
    const documentDelta = this.pendingDocumentDelta;
    if (mode === 'sheet') {
      return {
        mode,
        surface: measureSheetSurface(
          this.view,
          this.focusedReview(),
          this.sheet.element,
        ),
        documentDelta,
      };
    }
    return {
      mode,
      surface: measureExpandedSurface(this.view, this.rail, this.reviews),
      documentDelta,
      collisionDelta: this.pendingCollisionDelta,
    };
  }

  private commitMeasurement(measurement: SurfaceMeasurement): void {
    if (this.lifecycle.destroyed) return;
    if ('documentDelta' in measurement) {
      this.pendingDocumentDelta -= measurement.documentDelta;
    }
    if ('collisionDelta' in measurement) {
      this.pendingCollisionDelta -= measurement.collisionDelta;
    }
    if (measurement.mode === 'hidden') {
      this.snapshot = null;
      this.rail.clearLayout();
      return;
    }
    if (measurement.mode === 'sheet') {
      this.snapshot = null;
      this.rail.clearLayout();
      const delta = sheetDocumentDelta(
        measurement.surface.anchor,
        measurement.surface.viewport,
        measurement.surface.sheetHeight,
      );
      if (Math.abs(delta) >= 0.5) this.applyDocumentDelta(delta);
      return;
    }

    const computed = computeExpandedSnapshot(
      measurement.surface.items,
      measurement.surface.geometry,
      this.scrollState,
      { scrollMoved: Math.abs(measurement.documentDelta) >= 0.01 },
    );
    this.snapshot = computed;
    this.scrollState = computed.state;
    this.rail.commit(computed.layout, measurement.surface.geometry.railHeight);

    if (Math.abs(measurement.collisionDelta) < 0.01) return;
    const progress = finishCommentLaneScroll(
      this.scrollState,
      computed,
      measurement.collisionDelta,
    );
    this.scrollState = progress.state;
    if (progress.changed) this.schedule();
  }

  private readonly handleDocumentScroll = (): void => {
    const scrollTop = this.view.scrollDOM.scrollTop;
    const delta = scrollTop - this.previousScrollTop;
    this.previousScrollTop = scrollTop;
    if (!this.lifecycle.reviewing || Math.abs(delta) < 0.01) return;
    this.pendingDocumentDelta += delta;
    this.scrollState = scrollStateForDocumentDelta(this.scrollState, delta);
    this.schedule();
  };

  private readonly handleEditorResize = (
    entries: readonly ResizeObserverEntry[],
  ): void => {
    const entry = entries[entries.length - 1];
    if (entry === undefined || this.lifecycle.destroyed) return;
    const mode = chooseVisibleSurfaceMode(entry.contentRect.width);
    if (mode === this.mode) {
      this.schedule();
      return;
    }
    this.mode = mode;
    this.snapshot = null;
    // Re-evaluate the ViewPlugin-provided root attributes without changing state.
    this.view.update([]);
    this.schedule();
  };

  private readonly handleRailWheel = (event: WheelEvent): void => {
    if (this.mode !== 'expanded' || this.snapshot === null) return;
    const delta = normalizeWheelDelta(
      event.deltaY,
      event.deltaMode,
      this.rail.element.clientHeight,
    );
    if (Math.abs(delta) < 0.01) return;
    event.preventDefault();
    const transition = beginCommentLaneScroll(
      this.scrollState,
      this.snapshot,
      delta,
      this.rail.element.clientHeight,
    );
    this.scrollState = transition.state;
    if (transition.needsCollisionProgress) {
      this.pendingCollisionDelta += delta;
    }
    this.applyDocumentDelta(transition.documentDelta);
    this.schedule();
  };

  private applyDocumentDelta(delta: number): void {
    if (Math.abs(delta) < 0.01) return;
    const before = this.view.scrollDOM.scrollTop;
    this.view.scrollDOM.scrollTop = before + delta;
    const after = this.view.scrollDOM.scrollTop;
    const applied = after - before;
    this.previousScrollTop = after;
    this.pendingDocumentDelta += applied;
    this.scrollState = scrollStateForDocumentDelta(this.scrollState, applied);
    this.schedule();
  }

  private focusedReview(): ReviewItem | null {
    return (
      this.reviews.find(review => review.id === this.focusedReviewId) ?? null
    );
  }
}
