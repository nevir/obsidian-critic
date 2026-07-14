import {
  Decoration,
  type DecorationSet,
  EditorView,
  type PluginValue,
  type ViewUpdate,
} from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';

import type { ParsedDocument, ReviewItem, SourceRange } from '../../core/model';
import {
  acceptReview,
  rejectReview,
  resolveReview,
} from '../../core/mutations';
import { parseCriticMarkup } from '../../core/syntax/index';
import {
  adjacentReviewId,
  type NavigationDirection,
  reconcileFocusedReviewId,
} from '../review/navigation';
import {
  buildReviewPresentations,
  type ReviewAction,
} from '../review/presentation';
import { ReviewSurfaceController } from '../review/surface';
import { buildDecorationSpecs } from './decoration-specs';
import { createDecorationSet } from './decorations';
import type { CriticEditorHost } from './host';

export class CriticEditorSession implements PluginValue {
  decorations: DecorationSet = Decoration.none;
  private parsed: ParsedDocument;
  private livePreview: boolean;
  private focusedReviewId: string | null = null;
  private readonly surface: ReviewSurfaceController;

  constructor(
    readonly view: EditorView,
    private readonly host: CriticEditorHost,
  ) {
    this.parsed = parseCriticMarkup(view.state.doc.sliceString(0));
    this.livePreview = readLivePreview(view);
    this.rebuildDecorations();
    this.syncEditorClass();
    this.surface = new ReviewSurfaceController(view, host.app, {
      focus: reviewId => this.focusReview(reviewId),
      clearFocus: () => this.clearFocus(),
      act: (reviewId, action) => this.applyReviewAction(reviewId, action),
    });
    host.attachSession(this);
    this.syncSurface();
  }

  get sourcePath(): string {
    return this.view.state.field(editorInfoField, false)?.file?.path ?? '';
  }

  get focusedId(): string | null {
    return this.focusedReviewId;
  }

  get reviews(): readonly ReviewItem[] {
    return this.parsed.reviews;
  }

  update(update: ViewUpdate): void {
    const nextLivePreview = readLivePreview(this.view);
    const modeChanged = nextLivePreview !== this.livePreview;
    this.livePreview = nextLivePreview;

    if (update.docChanged) {
      const previousIds = this.reviewIds();
      this.parsed = parseCriticMarkup(update.state.doc.sliceString(0));
      this.focusedReviewId = reconcileFocusedReviewId(
        previousIds,
        this.reviewIds(),
        this.focusedReviewId,
      );
    }

    if (update.docChanged || update.selectionSet || modeChanged) {
      this.rebuildDecorations();
    }
    if (update.docChanged || modeChanged) this.syncSurface();
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      update.geometryChanged ||
      update.heightChanged ||
      modeChanged
    ) {
      this.surface.schedule();
    }
    if (update.docChanged || update.viewportChanged || modeChanged) {
      this.syncEditorClass();
      this.syncFocusClasses();
    }
  }

  docViewUpdate(): void {
    this.syncFocusClasses();
    this.surface.schedule();
  }

  destroy(): void {
    this.surface.destroy();
    this.host.detachSession(this);
    this.view.dom.classList.remove(
      'critic-editor',
      'critic-live-preview',
      'critic-expanded',
      'critic-sheet-mode',
    );
  }

  focusReview(reviewId: string): boolean {
    const review = this.reviewById(reviewId);
    if (review === undefined) return false;
    this.focusedReviewId = reviewId;
    this.syncFocusClasses();
    this.surface.setFocus(reviewId, this.sourcePath);
    this.view.dispatch({
      effects: EditorView.scrollIntoView(review.anchor.from, {
        y: 'nearest',
        yMargin: Math.min(48, this.view.scrollDOM.clientHeight / 4),
      }),
    });
    return true;
  }

  clearFocus(): void {
    if (this.focusedReviewId === null) return;
    this.focusedReviewId = null;
    this.syncFocusClasses();
    this.surface.setFocus(null, this.sourcePath);
  }

  navigate(direction: NavigationDirection): boolean {
    const reviewId = adjacentReviewId(
      this.reviewIds(),
      this.focusedReviewId,
      direction,
    );
    return reviewId === null ? false : this.focusReview(reviewId);
  }

  handleClick(event: MouseEvent): void {
    const reviewId = reviewIdFromEvent(event);
    if (reviewId === null) {
      this.clearFocus();
      return;
    }
    this.focusReview(reviewId);
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (this.focusedReviewId === null) return false;
    const direction = arrowDirection(event.key);
    if (direction === null) return false;
    this.navigate(direction);
    event.preventDefault();
    return true;
  }

  private applyReviewAction(reviewId: string, action: ReviewAction): void {
    const review = this.reviewById(reviewId);
    if (review === undefined) return;
    const edit = reviewEdit(review, action);
    if (edit === null) return;
    this.view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
    });
  }

  private rebuildDecorations(): void {
    this.decorations = this.livePreview
      ? createDecorationSet(
          buildDecorationSpecs(this.parsed, selectionRanges(this.view)),
        )
      : Decoration.none;
  }

  private reviewById(reviewId: string): ReviewItem | undefined {
    return this.parsed.reviews.find(review => review.id === reviewId);
  }

  private reviewIds(): string[] {
    return this.parsed.reviews.map(review => review.id);
  }

  private syncEditorClass(): void {
    const hasReviews = this.livePreview && this.parsed.reviews.length > 0;
    this.view.dom.classList.toggle('critic-editor', hasReviews);
    this.view.dom.classList.toggle('critic-live-preview', hasReviews);
  }

  private syncSurface(): void {
    this.surface.reconcile(
      this.parsed.reviews,
      buildReviewPresentations(this.parsed.reviews),
      this.focusedReviewId,
      this.sourcePath,
      this.livePreview && this.parsed.reviews.length > 0,
    );
  }

  private syncFocusClasses(): void {
    const focusedId = this.focusedReviewId;
    for (const element of this.view.dom.querySelectorAll<HTMLElement>(
      '[data-critic-review-id]',
    )) {
      element.classList.toggle(
        'critic-focused',
        element.dataset['criticReviewId'] === focusedId,
      );
    }
  }
}

function readLivePreview(view: EditorView): boolean {
  return view.state.field(editorLivePreviewField, false) ?? false;
}

function selectionRanges(view: EditorView): SourceRange[] {
  return view.state.selection.ranges.map(range => ({
    from: range.from,
    to: range.to,
  }));
}

function reviewIdFromEvent(event: MouseEvent): string | null {
  if (!(event.target instanceof Element)) return null;
  return (
    event.target.closest<HTMLElement>('[data-critic-review-id]')?.dataset[
      'criticReviewId'
    ] ?? null
  );
}

function arrowDirection(key: string): NavigationDirection | null {
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowRight') return 1;
  return null;
}

function reviewEdit(review: ReviewItem, action: ReviewAction) {
  switch (action) {
    case 'accept':
      return review.kind === 'suggestion' ? acceptReview(review) : null;
    case 'reject':
      return review.kind === 'suggestion' ? rejectReview(review) : null;
    case 'resolve':
      return resolveReview(review);
  }
}
