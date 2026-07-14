import type { Range } from '@codemirror/state';
import { Decoration, type DecorationSet, WidgetType } from '@codemirror/view';

import type { DecorationSpec } from './decoration-specs';

export function createDecorationSet(
  specs: readonly DecorationSpec[],
): DecorationSet {
  return Decoration.set(specs.flatMap(decorationRanges), true);
}

function decorationRanges(spec: DecorationSpec): Range<Decoration>[] {
  switch (spec.kind) {
    case 'mark':
      return [
        Decoration.mark({
          class: `critic-annotation critic-annotation-${spec.annotationClass}`,
          attributes: { 'data-critic-review-id': spec.reviewId },
        }).range(spec.from, spec.to),
      ];
    case 'replace':
      return [Decoration.replace({}).range(spec.from, spec.to)];
    case 'separator':
      return [
        Decoration.replace({ widget: new ChangeSeparatorWidget() }).range(
          spec.from,
          spec.to,
        ),
      ];
    case 'syntax': {
      const after = spec.placement === 'after';
      return [
        Decoration.replace({}).range(spec.from, spec.to),
        // Keep the visible token just outside Obsidian's competing replacement.
        Decoration.widget({
          widget: new SourceSyntaxWidget(spec.reviewId, spec.text),
          side: after ? 1 : -1,
        }).range(after ? spec.to : spec.from),
      ];
    }
    case 'widget':
      return [
        Decoration.widget({
          widget: new ReviewAnchorWidget(spec.reviewId, spec.role),
        }).range(spec.at),
      ];
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

class SourceSyntaxWidget extends WidgetType {
  constructor(
    private readonly reviewId: string,
    private readonly text: '==' | '~~',
  ) {
    super();
  }

  override eq(other: SourceSyntaxWidget): boolean {
    return this.reviewId === other.reviewId && this.text === other.text;
  }

  override toDOM(): HTMLElement {
    const syntax = document.createElement('span');
    syntax.className =
      'critic-annotation critic-annotation-expanded critic-source-syntax';
    syntax.dataset['criticReviewId'] = this.reviewId;
    syntax.textContent = this.text;
    return syntax;
  }

  override ignoreEvent(): boolean {
    return false;
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

  override ignoreEvent(): boolean {
    return false;
  }
}
