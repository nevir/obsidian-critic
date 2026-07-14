import {
  acceptReview,
  applySourceEdits,
  rejectReview,
  resolveReview,
} from './mutations';
import { parseCriticMarkup } from './syntax/index';

export type ReviewProjection = 'original' | 'proposed';

export function projectCriticMarkup(
  source: string,
  projection: ReviewProjection,
): string {
  const edits = parseCriticMarkup(source).reviews.flatMap(review => {
    if (review.kind === 'suggestion') {
      return [
        projection === 'proposed' ? acceptReview(review) : rejectReview(review),
      ];
    }
    const edit = resolveReview(review);
    return edit === null ? [] : [edit];
  });
  return applySourceEdits(source, edits);
}
