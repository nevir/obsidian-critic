import { type App, Component, MarkdownRenderer } from 'obsidian';
import {
  cardActionFromEvent,
  cardNavigationFromEvent,
  renderCardHeader,
  updateCardSequence,
} from './card-controls';
import type { NavigationDirection } from './navigation';
import type {
  ReviewAction,
  ReviewChangePresentation,
  ReviewMessagePresentation,
  ReviewPresentation,
} from './presentation';

export interface ReviewCardCallbacks {
  readonly focus: (reviewId: string) => void;
  readonly clearFocus: () => void;
  readonly navigate: (direction: NavigationDirection) => void;
  readonly act: (reviewId: string, action: ReviewAction) => void;
}

export interface ReviewCardOptions {
  readonly showNavigation?: boolean;
}

export class ReviewCard {
  readonly element: HTMLElement;
  private component: Component | null = null;
  private contentSignature = '';
  private renderGeneration = 0;

  constructor(
    private readonly app: App,
    private readonly callbacks: ReviewCardCallbacks,
    presentation: ReviewPresentation,
    index: number,
    total: number,
    sourcePath: string,
    private readonly options: ReviewCardOptions = {},
  ) {
    this.element = document.createElement('section');
    this.element.className = 'critic-review-card';
    this.element.tabIndex = 0;
    this.element.addEventListener('mousedown', this.stopEditorInput);
    this.element.addEventListener('touchstart', this.stopEditorInput, {
      passive: true,
    });
    this.element.addEventListener('click', this.handleClick);
    this.element.addEventListener('keydown', this.handleKeydown);
    this.update(presentation, index, total, sourcePath);
  }

  update(
    presentation: ReviewPresentation,
    index: number,
    total: number,
    sourcePath: string,
  ): void {
    this.element.dataset['criticReviewId'] = presentation.id;
    this.element.setAttribute('aria-label', `Review ${index + 1} of ${total}`);
    const signature = JSON.stringify([presentation, sourcePath]);
    if (signature !== this.contentSignature) {
      this.contentSignature = signature;
      this.render(presentation, sourcePath);
    }
    this.updatePosition(index, total);
  }

  private updatePosition(index: number, total: number): void {
    updateCardSequence(this.element, index, total);
  }

  setFocused(focused: boolean): void {
    this.element.classList.toggle('critic-focused', focused);
  }

  setVisible(visible: boolean): void {
    this.element.tabIndex = visible ? 0 : -1;
    this.element.toggleAttribute('aria-hidden', !visible);
  }

  destroy(): void {
    this.renderGeneration += 1;
    this.component?.unload();
    this.component = null;
    this.element.removeEventListener('mousedown', this.stopEditorInput);
    this.element.removeEventListener('touchstart', this.stopEditorInput);
    this.element.removeEventListener('click', this.handleClick);
    this.element.removeEventListener('keydown', this.handleKeydown);
    this.element.remove();
  }

  private render(presentation: ReviewPresentation, sourcePath: string): void {
    this.renderGeneration += 1;
    const generation = this.renderGeneration;
    this.component?.unload();
    this.component = new Component();
    this.component.load();
    this.element.replaceChildren(
      renderCardHeader(presentation, this.options.showNavigation === true),
      renderBody(
        this.app,
        presentation,
        sourcePath,
        this.component,
        () => generation === this.renderGeneration,
      ),
    );
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const direction = cardNavigationFromEvent(event);
    if (direction !== null) {
      event.stopPropagation();
      this.callbacks.navigate(direction);
      return;
    }
    const action = cardActionFromEvent(event);
    const reviewId = this.element.dataset['criticReviewId'];
    if (reviewId === undefined) return;
    event.stopPropagation();
    if (action !== null) {
      this.callbacks.act(reviewId, action);
      return;
    }
    this.callbacks.focus(reviewId);
  };

  private readonly stopEditorInput = (event: Event): void => {
    event.stopPropagation();
    if (event.type === 'mousedown') event.preventDefault();
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target !== this.element) return;
    const reviewId = this.element.dataset['criticReviewId'];
    if (reviewId === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    this.callbacks.focus(reviewId);
  };
}

function renderBody(
  app: App,
  presentation: ReviewPresentation,
  sourcePath: string,
  component: Component,
  isCurrent: () => boolean,
): HTMLElement {
  const body = document.createElement('div');
  body.className = 'critic-card-body';
  if (presentation.change !== null) {
    body.append(renderChange(presentation.change));
  }
  if (presentation.messages.length > 0) {
    const messages = document.createElement('div');
    messages.className = 'critic-card-messages';
    for (const message of presentation.messages) {
      messages.append(
        renderMessage(app, message, sourcePath, component, isCurrent),
      );
    }
    body.append(messages);
  }
  return body;
}

function renderChange(change: ReviewChangePresentation): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'critic-change-preview';
  if (change.original !== null) {
    const original = document.createElement('span');
    original.className = 'critic-change-original';
    original.textContent = change.original;
    preview.append(original);
  }
  if (change.original !== null && change.proposed !== null) {
    const arrow = document.createElement('span');
    arrow.className = 'critic-change-arrow';
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    preview.append(arrow);
  }
  if (change.proposed !== null) {
    const proposed = document.createElement('span');
    proposed.className = 'critic-change-proposed';
    proposed.textContent = change.proposed;
    preview.append(proposed);
  }
  return preview;
}

function renderMessage(
  app: App,
  message: ReviewMessagePresentation,
  sourcePath: string,
  component: Component,
  isCurrent: () => boolean,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'critic-card-message';
  if (message.authorLabel !== null) {
    const author = document.createElement('div');
    author.className = 'critic-card-author';
    author.textContent = message.authorLabel;
    container.append(author);
  }
  const content = document.createElement('div');
  content.className = 'critic-card-message-content markdown-rendered';
  container.append(content);
  MarkdownRenderer.render(
    app,
    message.markdown,
    content,
    sourcePath,
    component,
  ).catch(() => {
    if (isCurrent()) content.textContent = message.markdown;
  });
  return container;
}
