import type {
  AnchorMark,
  CommentMark,
  CriticMark,
  ReviewItem,
  SourceRange,
} from '../model';
import { sourceRange } from './ranges';

export function buildReviews(marks: readonly CriticMark[]): ReviewItem[] {
  const reviews: ReviewItem[] = [];

  for (let index = 0; index < marks.length; ) {
    const mark = marks[index];
    if (mark === undefined) break;

    if (mark.kind === 'comment') {
      const thread = collectThread(marks, index, mark.source.from);
      reviews.push(pointReview(thread.messages));
      index = thread.nextIndex;
      continue;
    }

    const nextFrom = mark.source.to;
    const thread = collectThread(marks, index + 1, nextFrom);
    reviews.push(anchoredReview(mark, thread.messages));
    index = thread.nextIndex;
  }

  return reviews;
}

function collectThread(
  marks: readonly CriticMark[],
  fromIndex: number,
  expectedFrom: number,
): { readonly messages: CommentMark[]; readonly nextIndex: number } {
  const messages: CommentMark[] = [];
  let index = fromIndex;
  let adjacentFrom = expectedFrom;

  while (index < marks.length) {
    const candidate = marks[index];
    if (
      candidate === undefined ||
      candidate.kind !== 'comment' ||
      candidate.source.from !== adjacentFrom
    ) {
      break;
    }
    messages.push(candidate);
    adjacentFrom = candidate.source.to;
    index += 1;
  }

  return { messages, nextIndex: index };
}

function anchoredReview(
  mark: AnchorMark,
  messages: readonly CommentMark[],
): ReviewItem {
  const threadRange = threadSource(messages);
  return {
    id: `review-${mark.source.from}`,
    kind: mark.kind === 'highlight' ? 'comment' : 'suggestion',
    mark,
    messages,
    source: sourceRange(mark.source.from, threadRange?.to ?? mark.source.to),
    threadRange,
    anchor: anchorRange(mark),
    point: false,
  };
}

function pointReview(messages: readonly CommentMark[]): ReviewItem {
  const threadRange = threadSource(messages);
  if (threadRange === null)
    throw new Error('A point review requires a message');
  return {
    id: `review-${threadRange.from}`,
    kind: 'comment',
    mark: null,
    messages,
    source: threadRange,
    threadRange,
    anchor: sourceRange(threadRange.from, threadRange.from),
    point: true,
  };
}

function threadSource(messages: readonly CommentMark[]): SourceRange | null {
  const first = messages[0];
  const last = messages[messages.length - 1];
  return first === undefined || last === undefined
    ? null
    : sourceRange(first.source.from, last.source.to);
}

function anchorRange(mark: AnchorMark): SourceRange {
  if (mark.kind === 'substitution') {
    return sourceRange(mark.originalRange.from, mark.replacementRange.to);
  }
  return mark.contentRange;
}
