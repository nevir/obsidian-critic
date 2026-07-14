import type { ReviewScrollState, ScrollStateOverrides } from './types';

export function createScrollState(
  overrides: ScrollStateOverrides = {},
): ReviewScrollState {
  return {
    focusedReviewId: overrides.focusedReviewId ?? null,
    driverId: overrides.driverId ?? null,
    scrollDirection: overrides.scrollDirection ?? 0,
    collisionProgressOffsets: cloneOffsetMap(
      overrides.collisionProgressOffsets,
    ),
    tallThreadOffsets: cloneOffsetMap(overrides.tallThreadOffsets),
  };
}

export function scrollStateForDocumentDelta(
  state: ReviewScrollState,
  documentDelta: number,
): ReviewScrollState {
  return {
    ...state,
    scrollDirection:
      documentDelta === 0 ? state.scrollDirection : Math.sign(documentDelta),
  };
}

export function scrollStateWithFocus(
  state: ReviewScrollState,
  focusedReviewId: string,
): ReviewScrollState {
  return {
    ...state,
    focusedReviewId,
    driverId: focusedReviewId,
    collisionProgressOffsets: new Map(),
    tallThreadOffsets: new Map(),
  };
}

export function scrollStateWithoutFocus(
  state: ReviewScrollState,
): ReviewScrollState {
  return {
    ...state,
    focusedReviewId: null,
    driverId: null,
    collisionProgressOffsets: new Map(),
    tallThreadOffsets: new Map(),
  };
}

export function cloneOffsetMap(
  values?: ReadonlyMap<string, number>,
): Map<string, number> {
  return values === undefined ? new Map() : new Map(values);
}
