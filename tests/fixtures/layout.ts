import type { LayoutMeasurement } from '../../src/core/layout/index.ts';

export const RAIL_HEIGHT = 706;
export const DOCUMENT_HEIGHT = 3000;
export const MAX_SCROLL_TOP = DOCUMENT_HEIGHT - RAIL_HEIGHT;

export interface ExampleCard {
  readonly id: string;
  readonly anchorTop: number;
  readonly height: number;
}

export const exampleCards: readonly ExampleCard[] = [
  { id: 's1', anchorTop: 120, height: 190 },
  { id: 'c1', anchorTop: 205, height: 239 },
  { id: 's2', anchorTop: 330, height: 97 },
  { id: 's3', anchorTop: 365, height: 157 },
  { id: 'p1', anchorTop: 410, height: 151 },
  { id: 'c2', anchorTop: 470, height: 162 },
  { id: 's4', anchorTop: 560, height: 194 },
  { id: 'c3', anchorTop: 1500, height: 230 },
  { id: 'c4', anchorTop: 1560, height: 151 },
  { id: 'c7', anchorTop: 1690, height: 170 },
  { id: 'c8', anchorTop: 1790, height: 151 },
  { id: 's5', anchorTop: 1900, height: 97 },
  { id: 'c5', anchorTop: 2020, height: 151 },
  { id: 's6', anchorTop: 2110, height: 97 },
  { id: 'c6', anchorTop: 2200, height: 190 },
  { id: 's7', anchorTop: 2260, height: 97 },
];

export function measurementsAt(
  scrollTop: number,
  cards: readonly ExampleCard[] = exampleCards,
): LayoutMeasurement[] {
  return cards.map(card => {
    const naturalTop = card.anchorTop - scrollTop;
    return {
      id: card.id,
      naturalTop,
      height: card.height,
      anchorRect: { top: naturalTop, bottom: naturalTop + 22 },
    };
  });
}

export function geometryAt(scrollTop: number) {
  return {
    railHeight: RAIL_HEIGHT,
    documentTop: -scrollTop,
    documentBottom: DOCUMENT_HEIGHT - scrollTop,
  };
}
