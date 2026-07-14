import type { CommentMark, ReviewItem } from '../../core/model';

export type ReviewAction = 'accept' | 'reject' | 'resolve';

export interface ReviewMessagePresentation {
  readonly id: string;
  readonly authorLabel: string | null;
  readonly markdown: string;
}

export interface ReviewChangePresentation {
  readonly original: string | null;
  readonly proposed: string | null;
}

export interface ReviewPresentation {
  readonly id: string;
  readonly change: ReviewChangePresentation | null;
  readonly messages: readonly ReviewMessagePresentation[];
  readonly headerActions: readonly ReviewAction[];
  readonly canResolveDiscussion: boolean;
}

export function buildReviewPresentations(
  reviews: readonly ReviewItem[],
): ReviewPresentation[] {
  const showAuthors = reviews.some(review =>
    review.messages.some(message => message.author !== null),
  );
  return reviews.map(review => ({
    id: review.id,
    change: changePresentation(review),
    messages: messagePresentations(review.messages, showAuthors),
    headerActions: headerActions(review),
    canResolveDiscussion:
      review.kind === 'suggestion' && review.messages.length > 0,
  }));
}

function changePresentation(
  review: ReviewItem,
): ReviewChangePresentation | null {
  const { mark } = review;
  if (mark === null) return null;
  switch (mark.kind) {
    case 'addition':
      return { original: null, proposed: mark.content };
    case 'deletion':
      return { original: mark.content, proposed: null };
    case 'substitution':
      return { original: mark.original, proposed: mark.replacement };
    case 'highlight':
      return null;
  }
}

function messagePresentations(
  messages: readonly CommentMark[],
  showAuthors: boolean,
): ReviewMessagePresentation[] {
  let previousAuthor: string | null = null;
  return messages.map(message => {
    const author = message.author ?? 'You';
    const authorLabel =
      showAuthors && author !== previousAuthor ? author : null;
    previousAuthor = author;
    return { id: message.id, authorLabel, markdown: message.body };
  });
}

function headerActions(review: ReviewItem): readonly ReviewAction[] {
  if (review.kind === 'comment') return ['resolve'];
  return ['reject', 'accept'];
}
