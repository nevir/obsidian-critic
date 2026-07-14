export type NavigationDirection = -1 | 1;

export function adjacentReviewId(
  reviewIds: readonly string[],
  focusedReviewId: string | null,
  direction: NavigationDirection,
): string | null {
  if (focusedReviewId === null) return null;
  const currentIndex = reviewIds.indexOf(focusedReviewId);
  if (currentIndex < 0) return null;
  return reviewIds[currentIndex + direction] ?? null;
}

export function reconcileFocusedReviewId(
  previousReviewIds: readonly string[],
  nextReviewIds: readonly string[],
  focusedReviewId: string | null,
): string | null {
  if (focusedReviewId === null || nextReviewIds.includes(focusedReviewId)) {
    return focusedReviewId;
  }
  const previousIndex = previousReviewIds.indexOf(focusedReviewId);
  if (previousIndex < 0) return null;
  return (
    nextReviewIds[previousIndex] ?? nextReviewIds[previousIndex - 1] ?? null
  );
}
