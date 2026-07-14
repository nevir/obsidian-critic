import type {
  AnchorMark,
  ParsedDocument,
  ReviewItem,
  SourceRange,
} from '../../core/model';

export type AnnotationClass =
  | 'addition'
  | 'deletion'
  | 'expanded'
  | 'highlight'
  | 'original'
  | 'replacement';

export type DecorationSpec =
  | {
      readonly kind: 'mark';
      readonly from: number;
      readonly to: number;
      readonly annotationClass: AnnotationClass;
      readonly reviewId: string;
    }
  | {
      readonly kind: 'replace';
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: 'separator';
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: 'widget';
      readonly at: number;
      readonly reviewId: string;
      readonly role: 'empty' | 'point';
    };

export function buildDecorationSpecs(
  document: ParsedDocument,
  selections: readonly SourceRange[] = [],
): DecorationSpec[] {
  return document.reviews.flatMap(review =>
    reviewIsSelected(review, selections)
      ? selectedReviewSpecs(review)
      : compactReviewSpecs(review),
  );
}

function compactReviewSpecs(review: ReviewItem): DecorationSpec[] {
  const specs = review.mark === null ? [] : anchorSpecs(review.id, review.mark);

  for (const message of review.messages) {
    specs.push(hiddenRange(message.source));
  }

  if (review.point) {
    specs.push({
      kind: 'widget',
      at: review.anchor.from,
      reviewId: review.id,
      role: 'point',
    });
  } else if (!specs.some(spec => spec.kind === 'mark')) {
    specs.push({
      kind: 'widget',
      at: review.anchor.from,
      reviewId: review.id,
      role: 'empty',
    });
  }

  return specs;
}

function selectedReviewSpecs(review: ReviewItem): DecorationSpec[] {
  return [
    visibleRange(review.id, review.source, 'expanded'),
    ...(review.mark === null ? [] : visibleRanges(review.id, review.mark)),
  ];
}

function anchorSpecs(reviewId: string, mark: AnchorMark): DecorationSpec[] {
  return [
    hiddenRange(mark.opener),
    ...visibleRanges(reviewId, mark),
    ...(mark.kind === 'substitution'
      ? [{ kind: 'separator' as const, ...mark.separator }]
      : []),
    hiddenRange(mark.closer),
  ];
}

function visibleRanges(reviewId: string, mark: AnchorMark): DecorationSpec[] {
  if (mark.kind === 'substitution') {
    return [
      visibleRange(reviewId, mark.originalRange, 'original'),
      visibleRange(reviewId, mark.replacementRange, 'replacement'),
    ].filter(isNonEmptyMark);
  }

  const annotationClass = annotationClassFor(mark);
  const spec = visibleRange(reviewId, mark.contentRange, annotationClass);
  return isNonEmptyMark(spec) ? [spec] : [];
}

function annotationClassFor(mark: AnchorMark) {
  switch (mark.kind) {
    case 'addition':
      return 'addition';
    case 'deletion':
      return 'deletion';
    case 'highlight':
      return 'highlight';
    case 'substitution':
      throw new TypeError('Substitutions use original and replacement ranges');
  }
}

function visibleRange(
  reviewId: string,
  range: SourceRange,
  annotationClass: AnnotationClass,
): DecorationSpec {
  return {
    kind: 'mark',
    from: range.from,
    to: range.to,
    annotationClass,
    reviewId,
  };
}

function hiddenRange(range: SourceRange): DecorationSpec {
  return { kind: 'replace', ...range };
}

function isNonEmptyMark(
  spec: DecorationSpec,
): spec is Extract<DecorationSpec, { readonly kind: 'mark' }> {
  return spec.kind === 'mark' && spec.from < spec.to;
}

function reviewIsSelected(
  review: ReviewItem,
  selections: readonly SourceRange[],
): boolean {
  return selections.some(selection =>
    rangesIntersect(selection, review.source),
  );
}

function rangesIntersect(left: SourceRange, right: SourceRange): boolean {
  if (left.from === left.to) {
    return left.from >= right.from && left.from < right.to;
  }
  return left.from < right.to && left.to > right.from;
}
