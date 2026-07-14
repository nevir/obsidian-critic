import { CARD_GAP, clamp } from './packing';
import type { LayoutMeasurement, WorkingLayoutItem } from './types';

export function focusedCardTargetTop(
  item: Pick<LayoutMeasurement, 'naturalTop' | 'height'> | undefined,
  railHeight: number,
  tallThreadOffset = 0,
): number {
  if (item === undefined) return 0;
  const viewportInset = 8;
  const availableHeight = railHeight - viewportInset * 2;
  if (item.height > availableHeight || tallThreadOffset > 0) {
    return item.naturalTop - tallThreadOffset;
  }

  const bottomEdge = railHeight - viewportInset;
  const bottomPinnedTop = bottomEdge - item.height;
  const releaseDistance = Math.max(120, Math.min(railHeight, item.height * 2));
  if (item.naturalTop < 0) {
    const distance = -item.naturalTop;
    return item.naturalTop - acceleratingRelease(distance, releaseDistance);
  }
  if (item.naturalTop <= bottomEdge) {
    return Math.min(item.naturalTop, bottomPinnedTop);
  }
  const distance = item.naturalTop - bottomEdge;
  return (
    bottomPinnedTop + distance + acceleratingRelease(distance, releaseDistance)
  );
}

export function pinItemTopInPlace(
  items: WorkingLayoutItem[],
  index: number,
  targetTop = items[index]?.naturalTop,
): void {
  const item = items[index];
  if (item === undefined || targetTop === undefined) return;
  item.top = targetTop;

  for (let itemIndex = index - 1; itemIndex >= 0; itemIndex -= 1) {
    const current = items[itemIndex];
    const next = items[itemIndex + 1];
    if (current === undefined || next === undefined) continue;
    const maximumTop = next.top - current.height - CARD_GAP;
    current.top = Math.min(current.top, maximumTop);
  }
  for (let itemIndex = index + 1; itemIndex < items.length; itemIndex += 1) {
    const previous = items[itemIndex - 1];
    const current = items[itemIndex];
    if (previous === undefined || current === undefined) continue;
    const minimumTop = previous.top + previous.height + CARD_GAP;
    current.top = Math.max(current.top, minimumTop);
  }
}

function acceleratingRelease(
  distance: number,
  releaseDistance: number,
): number {
  const positiveDistance = clamp(distance, 0, Number.POSITIVE_INFINITY);
  return (
    (positiveDistance * positiveDistance) / (positiveDistance + releaseDistance)
  );
}
