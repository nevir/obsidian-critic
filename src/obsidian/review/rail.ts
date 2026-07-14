import type { App } from 'obsidian';

import type { ExpandedLayout } from '../../core/layout/index';
import { ReviewCard, type ReviewCardCallbacks } from './card';
import type { ReviewPresentation } from './presentation';

export class ReviewRail {
  readonly element: HTMLElement;
  private readonly cards = new Map<string, ReviewCard>();
  private readonly resizeObserver: ResizeObserver;

  constructor(
    parent: HTMLElement,
    private readonly app: App,
    private readonly callbacks: ReviewCardCallbacks,
    onResize: () => void,
  ) {
    this.element = document.createElement('aside');
    this.element.className = 'critic-review-rail';
    this.element.setAttribute('aria-label', 'Review margin');
    this.element.addEventListener('click', this.handleBackgroundClick);
    parent.append(this.element);
    this.resizeObserver = new ResizeObserver(onResize);
  }

  reconcile(
    presentations: readonly ReviewPresentation[],
    sourcePath: string,
  ): void {
    const nextIds = new Set(presentations.map(presentation => presentation.id));
    for (const [id, card] of this.cards) {
      if (nextIds.has(id)) continue;
      this.resizeObserver.unobserve(card.element);
      card.destroy();
      this.cards.delete(id);
    }

    for (const [index, presentation] of presentations.entries()) {
      let card = this.cards.get(presentation.id);
      if (card === undefined) {
        card = new ReviewCard(
          this.app,
          this.callbacks,
          presentation,
          index,
          presentations.length,
          sourcePath,
        );
        this.cards.set(presentation.id, card);
        this.resizeObserver.observe(card.element);
      } else {
        card.update(presentation, index, presentations.length, sourcePath);
      }
      this.element.append(card.element);
    }
  }

  cardElement(reviewId: string): HTMLElement | null {
    return this.cards.get(reviewId)?.element ?? null;
  }

  setFocused(reviewId: string | null): void {
    for (const [id, card] of this.cards) {
      card.setFocused(id === reviewId);
    }
  }

  setBottomInset(inset: number): void {
    this.element.style.bottom = `${inset}px`;
  }

  commit(layout: ExpandedLayout, railHeight: number): void {
    const visibleIds = new Set<string>();
    for (const item of layout.items) {
      const card = this.cards.get(item.id);
      if (card === undefined) continue;
      visibleIds.add(item.id);
      const element = card.element;
      element.style.top = `${item.top}px`;
      const cardNear =
        item.top + item.height >= -80 && item.top <= railHeight + 80;
      const anchorNear =
        item.anchorRect.bottom >= -80 && item.anchorRect.top <= railHeight + 80;
      const visible = cardNear || anchorNear;
      card.setVisible(visible);
      element.classList.toggle('critic-offscreen', !visible);
      commitNib(element, item.anchorRect.top - item.top, item.height);
    }
    for (const [id, card] of this.cards) {
      if (visibleIds.has(id)) continue;
      card.setVisible(false);
      card.element.classList.add('critic-offscreen');
    }
  }

  clearLayout(): void {
    for (const card of this.cards.values()) {
      card.setVisible(true);
      card.element.style.removeProperty('top');
      card.element.classList.remove(
        'critic-offscreen',
        'critic-nib-hidden',
        'critic-nib-top',
        'critic-nib-bottom',
      );
    }
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.element.removeEventListener('click', this.handleBackgroundClick);
    for (const card of this.cards.values()) card.destroy();
    this.cards.clear();
    this.element.remove();
  }

  private readonly handleBackgroundClick = (event: MouseEvent): void => {
    if (event.target === this.element) this.callbacks.clearFocus();
  };
}

function commitNib(element: HTMLElement, nib: number, height: number): void {
  const hidden = nib < -1 || nib > height + 1;
  const cornerClearance = 16;
  element.classList.toggle('critic-nib-hidden', hidden);
  element.classList.toggle('critic-nib-top', !hidden && nib < cornerClearance);
  element.classList.toggle(
    'critic-nib-bottom',
    !hidden && nib > height - cornerClearance,
  );
  if (!hidden) {
    element.style.setProperty(
      '--critic-nib-y',
      `${Math.max(0, Math.min(height, nib))}px`,
    );
  }
}
