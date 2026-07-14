import type { ReviewItem, SourceEdit, SuggestionMark } from './model';

export function acceptReview(review: ReviewItem): SourceEdit {
  const mark = requireSuggestion(review);
  return replaceReview(review, acceptedText(mark));
}

export function rejectReview(review: ReviewItem): SourceEdit {
  const mark = requireSuggestion(review);
  return replaceReview(review, rejectedText(mark));
}

export function resolveReview(review: ReviewItem): SourceEdit | null {
  if (review.kind === 'suggestion') {
    return review.threadRange === null
      ? null
      : { ...review.threadRange, insert: '' };
  }

  if (review.mark?.kind === 'highlight') {
    return replaceReview(review, review.mark.content);
  }

  return { ...review.source, insert: '' };
}

export function applySourceEdits(
  source: string,
  edits: readonly SourceEdit[],
): string {
  const ordered = [...edits].sort(
    (left, right) => right.from - left.from || right.to - left.to,
  );
  let nextBoundary = source.length;
  let result = source;

  for (const edit of ordered) {
    validateEdit(edit, source.length);
    if (edit.to > nextBoundary) {
      throw new RangeError('Source edits must not overlap');
    }
    result = `${result.slice(0, edit.from)}${edit.insert}${result.slice(edit.to)}`;
    nextBoundary = edit.from;
  }

  return result;
}

function acceptedText(mark: SuggestionMark): string {
  switch (mark.kind) {
    case 'addition':
      return mark.content;
    case 'deletion':
      return '';
    case 'substitution':
      return mark.replacement;
  }
}

function rejectedText(mark: SuggestionMark): string {
  switch (mark.kind) {
    case 'addition':
      return '';
    case 'deletion':
      return mark.content;
    case 'substitution':
      return mark.original;
  }
}

function requireSuggestion(review: ReviewItem): SuggestionMark {
  const { mark } = review;
  if (
    review.kind !== 'suggestion' ||
    mark === null ||
    mark.kind === 'highlight'
  ) {
    throw new TypeError('Only suggestions can be accepted or rejected');
  }
  return mark;
}

function replaceReview(review: ReviewItem, insert: string): SourceEdit {
  return { ...review.source, insert };
}

function validateEdit(edit: SourceEdit, sourceLength: number): void {
  if (
    !Number.isSafeInteger(edit.from) ||
    !Number.isSafeInteger(edit.to) ||
    edit.from < 0 ||
    edit.to < edit.from ||
    edit.to > sourceLength
  ) {
    throw new RangeError(
      `Invalid source edit [${edit.from}, ${edit.to}) for ${sourceLength} characters`,
    );
  }
}
