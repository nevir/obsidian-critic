import {
  EditorView,
  type PluginValue,
  type ViewUpdate,
} from '@codemirror/view';
import { editorInfoField } from 'obsidian';

import type { ParsedDocument, ReviewItem } from '../../core/model';
import {
  acceptReview,
  rejectReview,
  resolveReview,
} from '../../core/mutations';
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
import { reconcileAnnotationDom } from './annotation-dom';
import type { CriticEditorHost } from './host';
import { criticEditorStateField } from './live-preview-state';
import { criticEditorRootAttributes } from './root-attributes';

export class CriticEditorSession implements PluginValue {
  private parsed: ParsedDocument;
  private livePreview: boolean;
  private focusedReviewId: string | null = null;
  private readonly surface: ReviewSurfaceController;

  constructor(
    readonly view: EditorView,
    host: CriticEditorHost,
  ) {
    const snapshot = view.state.field(criticEditorStateField);
    this.parsed = snapshot.parsed;
    this.livePreview = snapshot.livePreview;
    this.surface = new ReviewSurfaceController(
      view,
      host.app,
      {
        focus: reviewId => this.focusReview(reviewId),
        clearFocus: () => this.clearFocus(),
        act: (reviewId, action) => this.applyReviewAction(reviewId, action),
      },
      host.statusBarContainer,
    );
    this.syncSurface();
    this.syncAnnotationDom();
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

  get rootAttributes(): { readonly class: string } | null {
    return criticEditorRootAttributes(
      this.livePreview && this.parsed.reviews.length > 0,
      this.surface.presentationMode,
    );
  }

  update(update: ViewUpdate): void {
    const snapshot = update.state.field(criticEditorStateField);
    const nextLivePreview = snapshot.livePreview;
    const modeChanged = nextLivePreview !== this.livePreview;
    this.livePreview = nextLivePreview;

    if (update.docChanged) {
      const previousIds = this.reviewIds();
      this.parsed = snapshot.parsed;
      this.focusedReviewId = reconcileFocusedReviewId(
        previousIds,
        this.reviewIds(),
        this.focusedReviewId,
      );
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
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      modeChanged
    ) {
      this.syncAnnotationDom();
    }
  }

  docViewUpdate(): void {
    this.syncAnnotationDom();
    this.surface.schedule();
  }

  destroy(): void {
    this.surface.destroy();
  }

  focusReview(reviewId: string, scrollIntoView = true): boolean {
    const review = this.reviewById(reviewId);
    if (review === undefined) return false;
    this.focusedReviewId = reviewId;
    this.syncAnnotationDom();
    this.surface.setFocus(reviewId);
    if (scrollIntoView) {
      this.view.dispatch({
        effects: EditorView.scrollIntoView(review.anchor.from, {
          y: 'nearest',
          yMargin: Math.min(48, this.view.scrollDOM.clientHeight / 4),
        }),
      });
    }
    return true;
  }

  clearFocus(): void {
    if (this.focusedReviewId === null) return;
    this.focusedReviewId = null;
    this.syncAnnotationDom();
    this.surface.setFocus(null);
  }

  navigate(direction: NavigationDirection): boolean {
    const reviewId = adjacentReviewId(
      this.reviewIds(),
      this.focusedReviewId,
      direction,
    );
    return reviewId === null ? false : this.focusReview(reviewId);
  }

  handleMouseDown(event: MouseEvent): void {
    const target = reviewTargetFromEvent(event);
    if (target === null) {
      this.clearFocus();
      return;
    }
    const reviewId = target.dataset['criticReviewId'];
    if (reviewId === undefined) {
      this.clearFocus();
      return;
    }
    this.focusReview(
      reviewId,
      !target.matches('.critic-annotation, .critic-inline-anchor'),
    );
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

  private reviewById(reviewId: string): ReviewItem | undefined {
    return this.parsed.reviews.find(review => review.id === reviewId);
  }

  private reviewIds(): string[] {
    return this.parsed.reviews.map(review => review.id);
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

  private syncAnnotationDom(): void {
    reconcileAnnotationDom(this.view.dom, this.focusedReviewId);
  }
}

function reviewTargetFromEvent(event: MouseEvent): HTMLElement | null {
  if (!(event.target instanceof Element)) return null;
  return event.target.closest<HTMLElement>('[data-critic-review-id]');
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
