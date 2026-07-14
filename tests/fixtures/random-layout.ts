import {
  CARD_GAP,
  type LayoutMeasurement,
} from '../../src/core/layout/index.ts';

interface RandomLayoutFixture {
  readonly measurements: readonly LayoutMeasurement[];
  readonly geometry: {
    readonly railHeight: number;
    readonly documentTop: number;
    readonly documentBottom: number;
  };
}

export function randomFixture(
  random: () => number,
  minimumCount = 1,
  maximumCount = 30,
): RandomLayoutFixture {
  const railHeight = integer(random, 320, 1100);
  const documentHeight = integer(random, railHeight + 500, 8000);
  const scrollTop = integer(random, 0, documentHeight - railHeight);
  const count = integer(random, minimumCount, maximumCount);
  const anchors = Array.from({ length: count }, () =>
    integer(random, 0, documentHeight),
  ).sort((left, right) => left - right);
  return {
    measurements: anchors.map((anchorTop, index) => {
      const naturalTop = anchorTop - scrollTop;
      return {
        id: `item-${index}`,
        naturalTop,
        height: integer(random, 32, railHeight + 300),
        anchorRect: {
          top: naturalTop,
          bottom: naturalTop + integer(random, 1, 120),
        },
      };
    }),
    geometry: {
      railHeight,
      documentTop: -scrollTop,
      documentBottom: documentHeight - scrollTop,
    },
  };
}

export function feasibleFixture(random: () => number): RandomLayoutFixture {
  const railHeight = integer(random, 420, 1100);
  const count = integer(random, 1, 20);
  const heights = Array.from({ length: count }, () =>
    integer(random, 32, Math.min(360, railHeight + 100)),
  );
  const minimumDocumentHeight =
    heights.reduce((total, height) => total + height + CARD_GAP, 0) + 800;
  const documentHeight = integer(
    random,
    Math.max(railHeight + 500, minimumDocumentHeight),
    Math.max(railHeight + 1000, minimumDocumentHeight + 5000),
  );
  const scrollTop = integer(random, 0, documentHeight - railHeight - 1);
  const anchors = Array.from({ length: count }, () =>
    integer(random, 40, documentHeight - 40),
  ).sort((left, right) => left - right);
  return {
    measurements: anchors.map((anchorTop, index) => {
      const naturalTop = anchorTop - scrollTop;
      return {
        id: `item-${index}`,
        naturalTop,
        height: heights[index] ?? 32,
        anchorRect: { top: naturalTop, bottom: naturalTop + 20 },
      };
    }),
    geometry: {
      railHeight,
      documentTop: -scrollTop,
      documentBottom: documentHeight - scrollTop,
    },
  };
}

export function makeMeasurement(
  id: string,
  naturalTop: number,
  height: number,
): LayoutMeasurement {
  return {
    id,
    naturalTop,
    height,
    anchorRect: { top: naturalTop, bottom: naturalTop + 20 },
  };
}

export function integer(
  random: () => number,
  minimum: number,
  maximum: number,
): number {
  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d_2b_79_f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
