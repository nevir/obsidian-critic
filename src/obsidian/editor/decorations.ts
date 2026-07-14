import type { Range } from '@codemirror/state';
import { Decoration, type DecorationSet, WidgetType } from '@codemirror/view';

import type { DecorationSpec } from './decoration-specs';

export function createDecorationSet(
  specs: readonly DecorationSpec[],
): DecorationSet {
  return Decoration.set(specs.map(decorationRange), true);
}

function decorationRange(spec: DecorationSpec): Range<Decoration> {
  switch (spec.kind) {
    case 'mark':
      return Decoration.mark({
        class: `critic-annotation critic-annotation-${spec.annotationClass}`,
        attributes: { 'data-critic-review-id': spec.reviewId },
      }).range(spec.from, spec.to);
    case 'replace':
      return Decoration.replace({}).range(spec.from, spec.to);
    case 'separator':
      return Decoration.replace({ widget: new ChangeSeparatorWidget() }).range(
        spec.from,
        spec.to,
      );
    case 'widget':
      return Decoration.widget({
        widget: new ReviewAnchorWidget(spec.reviewId, spec.role),
      }).range(spec.at);
  }
}

class ChangeSeparatorWidget extends WidgetType {
  override eq(other: ChangeSeparatorWidget): boolean {
    return other instanceof ChangeSeparatorWidget;
  }

  override toDOM(): HTMLElement {
    const separator = document.createElement('span');
    separator.className = 'critic-substitution-separator';
    separator.textContent = '→';
    separator.setAttribute('aria-label', 'replaced with');
    return separator;
  }
}

class ReviewAnchorWidget extends WidgetType {
  constructor(
    private readonly reviewId: string,
    private readonly role: 'empty' | 'point',
  ) {
    super();
  }

  override eq(other: ReviewAnchorWidget): boolean {
    return this.reviewId === other.reviewId && this.role === other.role;
  }

  override toDOM(): HTMLElement {
    const anchor = document.createElement('button');
    anchor.type = 'button';
    anchor.className = `critic-inline-anchor critic-inline-anchor-${this.role}`;
    anchor.dataset['criticReviewId'] = this.reviewId;
    anchor.setAttribute(
      'aria-label',
      this.role === 'point' ? 'Open comment' : 'Open empty annotation',
    );
    return anchor;
  }
}
