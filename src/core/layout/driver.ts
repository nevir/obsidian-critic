import { CARD_GAP } from './packing';
import type { LayoutItem, MutableLayoutItem } from './types';

interface DriverOptions {
  readonly focusedReviewId: string | null;
  readonly sharedAnchorId: string | null;
  readonly scrollDirection: number;
  readonly scrollMoved: boolean;
  readonly railHeight: number;
}

export function itemCanOwnAnchor(
  item: Pick<LayoutItem, 'naturalTop' | 'top' | 'height'>,
): boolean {
  return (
    item.naturalTop >= item.top - 1 &&
    item.naturalTop <= item.top + item.height + 1
  );
}

export function correctAnchorInPlace(
  items: MutableLayoutItem[],
  index: number,
): void {
  const item = items[index];
  if (item === undefined) return;
  const correction = anchorEdgeCorrection(item);
  if (Math.abs(correction) <= 1e-9) return;
  item.top += correction;

  if (correction < 0) propagateBackward(items, index);
  else propagateForward(items, index);
}

export function choosePivotIndex(
  items: readonly LayoutItem[],
  options: DriverOptions,
): number {
  const {
    focusedReviewId,
    sharedAnchorId,
    scrollDirection,
    scrollMoved,
    railHeight,
  } = options;
  const railCenter = railHeight / 2;
  const handoffBand = railHeight * 0.22;
  const focusedIndex = focusedReviewId
    ? items.findIndex(item => item.id === focusedReviewId)
    : -1;
  if (focusedIndex >= 0) {
    const item = items[focusedIndex];
    if (
      item !== undefined &&
      item.anchorRect.bottom >= 0 &&
      item.anchorRect.top <= railHeight
    ) {
      return focusedIndex;
    }
  }

  const previousIndex = sharedAnchorId
    ? items.findIndex(item => item.id === sharedAnchorId)
    : -1;
  if (previousIndex >= 0) {
    const previous = items[previousIndex];
    if (previous !== undefined) {
      if (!scrollMoved && itemIsNearViewport(previous, railHeight)) {
        return previousIndex;
      }
      const center = previous.top + previous.height / 2;
      if (
        insideDirectionalBand(
          center,
          railCenter,
          handoffBand,
          scrollDirection,
        ) &&
        itemIsNearViewport(previous, railHeight)
      ) {
        return previousIndex;
      }
      if (scrollDirection !== 0) {
        if (!itemCanOwnAnchor(previous)) return previousIndex;
        const directional = eligibleCandidates(items, railHeight).filter(
          candidate => scrollDirection * (candidate.index - previousIndex) > 0,
        );
        if (directional.length > 0) {
          return nearestToCenter(directional, railCenter).index;
        }
        return previousIndex;
      }
    }
  }

  const truthful = eligibleCandidates(items, railHeight);
  const candidates =
    truthful.length > 0
      ? truthful
      : items.map((item, index) => ({ item, index }));
  return candidates.length === 0
    ? -1
    : nearestToCenter(candidates, railCenter).index;
}

export function chooseTruthfulPivotIndex(
  items: readonly LayoutItem[],
  preferredIndex: number,
  railHeight: number,
): number {
  const preferred = items[preferredIndex];
  if (preferred !== undefined && itemCanOwnAnchor(preferred))
    return preferredIndex;
  const candidates = eligibleCandidates(items, railHeight);
  return candidates.length === 0
    ? -1
    : nearestToCenter(candidates, railHeight / 2).index;
}

function anchorEdgeCorrection(item: MutableLayoutItem): number {
  if (item.naturalTop < item.top) return item.naturalTop - item.top;
  if (item.naturalTop > item.top + item.height) {
    return item.naturalTop - (item.top + item.height);
  }
  return 0;
}

function propagateBackward(items: MutableLayoutItem[], index: number): void {
  for (let itemIndex = index - 1; itemIndex >= 0; itemIndex -= 1) {
    const current = items[itemIndex];
    const next = items[itemIndex + 1];
    if (current === undefined || next === undefined) continue;
    const maximumTop = next.top - current.height - CARD_GAP;
    if (current.top <= maximumTop) break;
    current.top = maximumTop;
  }
}

function propagateForward(items: MutableLayoutItem[], index: number): void {
  for (let itemIndex = index + 1; itemIndex < items.length; itemIndex += 1) {
    const previous = items[itemIndex - 1];
    const current = items[itemIndex];
    if (previous === undefined || current === undefined) continue;
    const minimumTop = previous.top + previous.height + CARD_GAP;
    if (current.top >= minimumTop) break;
    current.top = minimumTop;
  }
}

function itemIsNearViewport(item: LayoutItem, railHeight: number): boolean {
  const anchorNear =
    item.anchorRect.bottom >= -80 && item.anchorRect.top <= railHeight + 80;
  const cardNear = item.top + item.height >= -80 && item.top <= railHeight + 80;
  return anchorNear || cardNear;
}

function eligibleCandidates(items: readonly LayoutItem[], railHeight: number) {
  return items
    .map((item, index) => ({ item, index }))
    .filter(
      candidate =>
        itemCanOwnAnchor(candidate.item) &&
        itemIsNearViewport(candidate.item, railHeight),
    );
}

function nearestToCenter<T extends { readonly item: LayoutItem }>(
  candidates: readonly T[],
  railCenter: number,
): T {
  const first = candidates[0];
  if (first === undefined) throw new Error('A driver candidate is required');
  return candidates.reduce((nearest, candidate) =>
    distanceFromCenter(candidate.item, railCenter) <
    distanceFromCenter(nearest.item, railCenter)
      ? candidate
      : nearest,
  );
}

function distanceFromCenter(item: LayoutItem, railCenter: number): number {
  return Math.abs(item.top + item.height / 2 - railCenter);
}

function insideDirectionalBand(
  center: number,
  railCenter: number,
  handoffBand: number,
  direction: number,
): boolean {
  if (direction > 0) return center >= railCenter - handoffBand;
  if (direction < 0) return center <= railCenter + handoffBand;
  return Math.abs(center - railCenter) <= handoffBand;
}
