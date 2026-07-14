import type { SourceRange } from '../model';

export function containsOffset(
  candidate: SourceRange,
  offset: number,
): boolean {
  return offset >= candidate.from && offset < candidate.to;
}

export function sourceRange(from: number, to: number): SourceRange {
  return { from, to };
}

export function mergeRanges(ranges: readonly SourceRange[]): SourceRange[] {
  const sorted = [...ranges].sort((left, right) => left.from - right.from);
  const merged: SourceRange[] = [];

  for (const current of sorted) {
    const previous = merged[merged.length - 1];
    if (previous === undefined || current.from > previous.to) {
      merged.push({ ...current });
      continue;
    }
    merged[merged.length - 1] = {
      from: previous.from,
      to: Math.max(previous.to, current.to),
    };
  }

  return merged;
}
