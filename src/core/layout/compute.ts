import { choosePivotIndex, correctAnchorInPlace } from './driver';
import { focusedCardTargetTop, pinItemTopInPlace } from './focus';
import {
  buildCollisionGroups,
  CARD_GAP,
  clamp,
  solveProjectedTops,
} from './packing';
import { cloneOffsetMap } from './state';
import type {
  ComputeSnapshotOptions,
  ExpandedLayout,
  ExpandedSnapshot,
  LayoutGeometry,
  LayoutItem,
  LayoutMeasurement,
  ReviewScrollState,
  WorkingLayoutItem,
} from './types';

interface ComputeLayoutOptions extends LayoutGeometry {
  readonly focusedReviewId: string | null;
  readonly previousDriverId: string | null;
  readonly scrollDirection: number;
  readonly scrollMoved: boolean;
  readonly collisionProgressOffsets: ReadonlyMap<string, number>;
  readonly tallThreadOffsets: ReadonlyMap<string, number>;
}

interface ComputedLayout extends ExpandedLayout {
  readonly absorbedCollisionKeys: readonly string[];
}

export function computeExpandedSnapshot(
  measurements: readonly LayoutMeasurement[],
  geometry: LayoutGeometry,
  state: ReviewScrollState,
  options: ComputeSnapshotOptions = {},
): ExpandedSnapshot {
  const computed = computeExpandedLayout(measurements, {
    ...geometry,
    focusedReviewId: state.focusedReviewId,
    previousDriverId: state.driverId,
    scrollDirection: state.scrollDirection,
    scrollMoved: options.scrollMoved ?? false,
    collisionProgressOffsets: state.collisionProgressOffsets,
    tallThreadOffsets: state.tallThreadOffsets,
  });
  const collisionProgressOffsets = cloneOffsetMap(
    state.collisionProgressOffsets,
  );
  for (const key of computed.absorbedCollisionKeys) {
    collisionProgressOffsets.delete(key);
  }
  const layout: ExpandedLayout = {
    items: computed.items,
    pivotIndex: computed.pivotIndex,
  };
  return {
    layout,
    state: {
      ...state,
      driverId: layout.items[layout.pivotIndex]?.id ?? null,
      collisionProgressOffsets,
    },
  };
}

function computeExpandedLayout(
  measurements: readonly LayoutMeasurement[],
  options: ComputeLayoutOptions,
): ComputedLayout {
  // The solver moves through automatic targets, non-overlap projection,
  // explicit focus pinning, continuity correction, and document-edge release.
  // Working values stay private; callers receive only committed geometry.
  const items = measurements.map<WorkingLayoutItem>(measurement => ({
    ...measurement,
    anchorRect: { ...measurement.anchorRect },
    desiredTop: measurement.naturalTop,
    automaticDesiredTop: measurement.naturalTop,
    top: measurement.naturalTop,
  }));
  if (items.length === 0) return emptyLayout();

  const focusedIndex = options.focusedReviewId
    ? items.findIndex(item => item.id === options.focusedReviewId)
    : -1;
  const absorbedCollisionKeys = assignAutomaticTargets(items, options);
  solveProjectedTops(items, options);

  const focusedItem = items[focusedIndex];
  const focusedOffset =
    focusedItem === undefined
      ? 0
      : (options.tallThreadOffsets.get(focusedItem.id) ?? 0);
  const focusedTarget =
    focusedItem === undefined
      ? undefined
      : focusedCardTargetTop(focusedItem, options.railHeight, focusedOffset);
  pinItemTopInPlace(items, focusedIndex, focusedTarget);

  const boundaryTops = items.map(item => item.top);
  const layoutPivotIndex = choosePivotIndex(items, {
    focusedReviewId: options.focusedReviewId,
    previousDriverId: options.previousDriverId,
    scrollDirection: options.scrollDirection,
    scrollMoved: options.scrollMoved,
    railHeight: options.railHeight,
  });
  if (focusedIndex < 0) correctAnchorInPlace(items, layoutPivotIndex);
  pinItemTopInPlace(items, focusedIndex, focusedTarget);
  blendDocumentBoundaries(items, boundaryTops, options);

  return {
    items: items.map(commitLayoutItem),
    pivotIndex: layoutPivotIndex,
    absorbedCollisionKeys,
  };
}

function assignAutomaticTargets(
  items: WorkingLayoutItem[],
  options: ComputeLayoutOptions,
): string[] {
  const absorbed: string[] = [];
  for (const group of buildCollisionGroups(items)) {
    if (group.length === 1) {
      const item = group[0];
      if (item !== undefined) {
        item.automaticDesiredTop =
          item.naturalTop - (options.tallThreadOffsets.get(item.id) ?? 0);
      }
      continue;
    }
    assignCollisionTargets(group, options, absorbed);
  }
  return absorbed;
}

function assignCollisionTargets(
  group: WorkingLayoutItem[],
  options: ComputeLayoutOptions,
  absorbed: string[],
): void {
  const first = group[0];
  const last = group[group.length - 1];
  if (first === undefined || last === undefined) return;
  const key = `${first.id}:${last.id}`;
  const early = forwardCollisionTops(group);
  const late = backwardCollisionTops(group);
  const annotationSpan = last.naturalTop - first.naturalTop;
  const entryLine = options.railHeight * 0.72;
  const exitLine = options.railHeight * 0.28;
  const corridor = Math.max(1, entryLine - exitLine + annotationSpan);
  const automaticProgress = clamp(
    (entryLine - first.naturalTop) / corridor,
    0,
    1,
  );
  let progressOffset = options.collisionProgressOffsets.get(key) ?? 0;
  if (
    (automaticProgress >= 1 && progressOffset > 0) ||
    (automaticProgress <= 0 && progressOffset < 0)
  ) {
    absorbed.push(key);
    progressOffset = 0;
  }
  const effectiveProgress = clamp(automaticProgress + progressOffset, 0, 1);
  const groupTravel = Math.max(
    CARD_GAP,
    ...group.map((_, index) => (early[index] ?? 0) - (late[index] ?? 0)),
  );

  for (const [index, item] of group.entries()) {
    const earlyTop = early[index];
    const lateTop = late[index];
    if (earlyTop === undefined || lateTop === undefined) continue;
    item.automaticDesiredTop =
      earlyTop + (lateTop - earlyTop) * effectiveProgress;
    item.groupKey = key;
    item.groupProgress = automaticProgress;
    item.groupTravel = groupTravel;
  }
}

function forwardCollisionTops(group: readonly WorkingLayoutItem[]): number[] {
  const tops: number[] = [];
  for (const [index, item] of group.entries()) {
    const previous = group[index - 1];
    const previousTop = tops[index - 1];
    tops[index] =
      previous === undefined || previousTop === undefined
        ? item.naturalTop
        : Math.max(item.naturalTop, previousTop + previous.height + CARD_GAP);
  }
  return tops;
}

function backwardCollisionTops(group: readonly WorkingLayoutItem[]): number[] {
  const tops: number[] = [];
  for (let index = group.length - 1; index >= 0; index -= 1) {
    const item = group[index];
    const next = group[index + 1];
    const nextTop = tops[index + 1];
    if (item === undefined) continue;
    tops[index] =
      next === undefined || nextTop === undefined
        ? item.naturalTop
        : Math.min(item.naturalTop, nextTop - item.height - CARD_GAP);
  }
  return tops;
}

function blendDocumentBoundaries(
  items: WorkingLayoutItem[],
  boundaryTops: readonly number[],
  geometry: LayoutGeometry,
): void {
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) return;
  const topInfluence = clamp(
    1 + geometry.documentTop / Math.max(1, geometry.railHeight),
    0,
    1,
  );
  const bottomInfluence = clamp(
    1 -
      (geometry.documentBottom - geometry.railHeight) /
        Math.max(1, geometry.railHeight),
    0,
    1,
  );
  const blend = Math.max(
    first.top < geometry.documentTop ? topInfluence : 0,
    last.top + last.height > geometry.documentBottom ? bottomInfluence : 0,
  );
  if (blend <= 0) return;
  for (const [index, item] of items.entries()) {
    const boundaryTop = boundaryTops[index];
    if (boundaryTop !== undefined) {
      item.top += (boundaryTop - item.top) * blend;
    }
  }
}

function commitLayoutItem(item: WorkingLayoutItem): LayoutItem {
  return {
    id: item.id,
    naturalTop: item.naturalTop,
    height: item.height,
    anchorRect: item.anchorRect,
    top: item.top,
    ...(item.groupKey === undefined ? {} : { groupKey: item.groupKey }),
    ...(item.groupProgress === undefined
      ? {}
      : { groupProgress: item.groupProgress }),
    ...(item.groupTravel === undefined
      ? {}
      : { groupTravel: item.groupTravel }),
  };
}

function emptyLayout(): ComputedLayout {
  return {
    items: [],
    pivotIndex: -1,
    absorbedCollisionKeys: [],
  };
}
