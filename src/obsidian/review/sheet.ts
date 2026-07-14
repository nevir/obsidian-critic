import type { App } from 'obsidian';

import { ReviewCard, type ReviewCardCallbacks } from './card';
import type { ReviewPresentation } from './presentation';

export class ReviewSheet {
  readonly element: HTMLElement;
  private card: ReviewCard | null = null;
  private reviewId: string | null = null;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    parent: HTMLElement,
    private readonly app: App,
    private readonly callbacks: ReviewCardCallbacks,
    onResize: () => void,
  ) {
    this.element = document.createElement('aside');
    this.element.className = 'critic-review-sheet';
    this.element.setAttribute('aria-label', 'Focused review');
    parent.append(this.element);
    this.resizeObserver = new ResizeObserver(onResize);
    this.resizeObserver.observe(this.element);
  }

  show(
    presentation: ReviewPresentation | null,
    index: number,
    total: number,
    sourcePath: string,
  ): void {
    if (presentation === null) {
      this.clear();
      return;
    }
    if (this.card === null || this.reviewId !== presentation.id) {
      this.card?.destroy();
      this.card = new ReviewCard(
        this.app,
        this.callbacks,
        presentation,
        index,
        total,
        sourcePath,
        { showNavigation: true },
      );
      this.reviewId = presentation.id;
      this.element.append(this.card.element);
    } else {
      this.card.update(presentation, index, total, sourcePath);
    }
    this.card.setFocused(true);
    this.element.classList.add('critic-open');
  }

  setBottomInset(inset: number): void {
    this.element.style.setProperty('--critic-host-bottom-inset', `${inset}px`);
  }

  clear(): void {
    this.element.classList.remove('critic-open');
    this.card?.destroy();
    this.card = null;
    this.reviewId = null;
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.clear();
    this.element.remove();
  }
}
