import type { LayoutGeometry, MutableLayoutItem } from './types';

export const CARD_GAP = 8;

interface ProjectionBlock {
  start: number;
  end: number;
  weight: number;
  weightedTop: number;
  mean: number;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function buildCollisionGroups(
  items: readonly MutableLayoutItem[],
): MutableLayoutItem[][] {
  const groups: MutableLayoutItem[][] = [];
  let current: MutableLayoutItem[] = [];
  let naturalEnd = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    if (current.length > 0 && item.naturalTop >= naturalEnd + CARD_GAP) {
      groups.push(current);
      current = [];
      naturalEnd = Number.NEGATIVE_INFINITY;
    }
    current.push(item);
    naturalEnd = Math.max(naturalEnd, item.naturalTop + item.height);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

export function projectNonOverlappingTops(items: MutableLayoutItem[]): void {
  const cumulativeOffsets: number[] = [];
  const blocks: ProjectionBlock[] = [];
  let cumulativeOffset = 0;

  for (const [index, item] of items.entries()) {
    cumulativeOffsets[index] = cumulativeOffset;
    const block: ProjectionBlock = {
      start: index,
      end: index,
      weight: 1,
      weightedTop: item.desiredTop - cumulativeOffset,
      mean: item.desiredTop - cumulativeOffset,
    };
    blocks.push(block);

    while (blocks.length > 1) {
      const previous = blocks[blocks.length - 2];
      const current = blocks[blocks.length - 1];
      if (
        previous === undefined ||
        current === undefined ||
        previous.mean <= current.mean
      ) {
        break;
      }
      const right = blocks.pop();
      const left = blocks.pop();
      if (left === undefined || right === undefined) break;
      const merged: ProjectionBlock = {
        start: left.start,
        end: right.end,
        weight: left.weight + right.weight,
        weightedTop: left.weightedTop + right.weightedTop,
        mean: 0,
      };
      merged.mean = merged.weightedTop / merged.weight;
      blocks.push(merged);
    }
    cumulativeOffset += item.height + CARD_GAP;
  }

  for (const block of blocks) {
    for (let index = block.start; index <= block.end; index += 1) {
      const item = items[index];
      const offset = cumulativeOffsets[index];
      if (item !== undefined && offset !== undefined)
        item.top = block.mean + offset;
    }
  }
}

export function solveProjectedTops(
  items: MutableLayoutItem[],
  geometry: LayoutGeometry,
): void {
  for (const item of items) item.desiredTop = item.automaticDesiredTop;
  projectNonOverlappingTops(items);
  constrainProjectedTopsToDocument(items, geometry);
}

export function constrainProjectedTopsToDocument(
  items: MutableLayoutItem[],
  { documentTop, documentBottom, railHeight }: LayoutGeometry,
): void {
  const first = items[0];
  if (first === undefined) return;
  const requiredSpan = items.reduce(
    (total, item, index) => total + item.height + (index === 0 ? 0 : CARD_GAP),
    0,
  );
  const availableSpan = documentBottom - documentTop;
  const releaseDistance = Math.max(1, railHeight);
  let topInfluence = clamp(1 + documentTop / releaseDistance, 0, 1);
  let bottomInfluence = clamp(
    1 - (documentBottom - railHeight) / releaseDistance,
    0,
    1,
  );

  if (
    requiredSpan > availableSpan + 1 &&
    topInfluence > 0 &&
    bottomInfluence > 0
  ) {
    if (topInfluence >= bottomInfluence) bottomInfluence = 0;
    else topInfluence = 0;
  }

  const topCorrection = Math.max(0, documentTop - first.top) * topInfluence;
  if (topCorrection >= 1e-3) {
    first.top += topCorrection;
    packForward(items);
  }

  const last = items[items.length - 1];
  if (last === undefined) return;
  const bottomCorrection =
    Math.max(0, last.top + last.height - documentBottom) * bottomInfluence;
  if (bottomCorrection >= 1e-3) {
    last.top -= bottomCorrection;
    packBackward(items);
  }
}

function packForward(items: MutableLayoutItem[]): void {
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    if (previous === undefined || current === undefined) continue;
    current.top = Math.max(
      current.top,
      previous.top + previous.height + CARD_GAP,
    );
  }
}

function packBackward(items: MutableLayoutItem[]): void {
  for (let index = items.length - 2; index >= 0; index -= 1) {
    const current = items[index];
    const next = items[index + 1];
    if (current === undefined || next === undefined) continue;
    current.top = Math.min(current.top, next.top - current.height - CARD_GAP);
  }
}
