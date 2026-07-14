import { clamp } from './packing';
import { cloneOffsetMap } from './state';
import type {
  ExpandedSnapshot,
  LayoutItem,
  ProgressTransition,
  ReviewScrollState,
  ScrollTransition,
} from './types';

export interface TallThreadTransition {
  readonly documentDelta: number;
  readonly offset: number;
  readonly maximumOffset: number;
}

interface CollisionProgress {
  readonly offset: number;
  readonly applies: boolean;
  readonly remove: boolean;
}

export function beginCommentLaneScroll(
  state: ReviewScrollState,
  snapshot: Pick<ExpandedSnapshot, 'layout'>,
  delta: number,
  railHeight: number,
): ScrollTransition {
  const driver = snapshot.layout.items[snapshot.layout.pivotIndex];
  if (driver === undefined || driver.height <= railHeight - 16) {
    return { state, documentDelta: delta, needsCollisionProgress: true };
  }

  const tallThreadOffsets = cloneOffsetMap(state.tallThreadOffsets);
  const transition = splitTallThreadDelta(
    driver,
    delta,
    tallThreadOffsets.get(driver.id) ?? 0,
    railHeight,
  );
  tallThreadOffsets.set(driver.id, transition.offset);
  return {
    state: { ...state, tallThreadOffsets },
    documentDelta: transition.documentDelta,
    needsCollisionProgress: false,
  };
}

export function finishCommentLaneScroll(
  state: ReviewScrollState,
  snapshot: Pick<ExpandedSnapshot, 'layout'>,
  delta: number,
): ProgressTransition {
  const driver = snapshot.layout.items[snapshot.layout.pivotIndex];
  const collisionProgressOffsets = cloneOffsetMap(
    state.collisionProgressOffsets,
  );
  const groupKey = driver?.groupKey;
  const previousOffset =
    groupKey === undefined ? 0 : (collisionProgressOffsets.get(groupKey) ?? 0);
  const progress = nextCollisionProgressOffset(driver, delta, previousOffset);

  if (progress.remove && groupKey !== undefined) {
    collisionProgressOffsets.delete(groupKey);
    return {
      state: { ...state, collisionProgressOffsets },
      changed: true,
    };
  }
  if (!progress.applies || groupKey === undefined) {
    return { state, changed: false };
  }
  collisionProgressOffsets.set(groupKey, progress.offset);
  return {
    state: { ...state, collisionProgressOffsets },
    changed: true,
  };
}

export function splitTallThreadDelta(
  item: Pick<LayoutItem, 'height' | 'naturalTop'>,
  delta: number,
  currentOffset: number,
  railHeight: number,
): TallThreadTransition {
  const maximumOffset = Math.max(0, item.height - railHeight + 16);
  let offset = currentOffset;
  let remaining = delta;
  let documentDelta = 0;

  if (remaining > 0 && offset === 0 && item.naturalTop > 12) {
    const approachDelta = Math.min(remaining, item.naturalTop - 12);
    documentDelta += approachDelta;
    remaining -= approachDelta;
  }
  if (remaining > 0 && offset < maximumOffset) {
    const localDelta = Math.min(remaining, maximumOffset - offset);
    offset += localDelta;
    remaining -= localDelta;
  } else if (remaining < 0 && offset > 0) {
    const localDelta = Math.min(-remaining, offset);
    offset -= localDelta;
    remaining += localDelta;
  }
  documentDelta += remaining;
  return { documentDelta, offset, maximumOffset };
}

export function nextCollisionProgressOffset(
  item: LayoutItem | undefined,
  delta: number,
  previousOffset: number,
): CollisionProgress {
  if (
    item?.groupKey === undefined ||
    item.groupTravel === undefined ||
    item.groupProgress === undefined
  ) {
    return { offset: previousOffset, applies: false, remove: false };
  }
  const requestedProgress = (delta * 0.62) / item.groupTravel;
  const offset = clamp(
    previousOffset + requestedProgress,
    -item.groupProgress,
    1 - item.groupProgress,
  );
  const completedForward =
    delta > 0 && item.groupProgress >= 1 && offset >= -1e-9;
  const completedBackward =
    delta < 0 && item.groupProgress <= 0 && offset <= 1e-9;
  if (completedForward || completedBackward) {
    return { offset: 0, applies: false, remove: true };
  }
  return { offset, applies: true, remove: false };
}
