import type { SourceRange } from '../model';
import { isEscaped } from './escapes';
import { containsOffset, mergeRanges, sourceRange } from './ranges';

interface Fence {
  readonly character: '`' | '~';
  readonly length: number;
  readonly from: number;
}

export function findCodeRanges(source: string): SourceRange[] {
  const fenced = findFencedCodeRanges(source);
  const inline = findInlineCodeRanges(source, fenced);
  return mergeRanges([...fenced, ...inline]);
}

export function offsetIsInRanges(
  ranges: readonly SourceRange[],
  offset: number,
): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = ranges[middle];
    if (candidate === undefined) return false;
    if (containsOffset(candidate, offset)) return true;
    if (offset < candidate.from) high = middle - 1;
    else low = middle + 1;
  }
  return false;
}

function findFencedCodeRanges(source: string): SourceRange[] {
  const ranges: SourceRange[] = [];
  let openFence: Fence | null = null;
  let lineStart = 0;

  while (lineStart <= source.length) {
    const newline = source.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? source.length : newline;
    const line = source.slice(lineStart, lineEnd);
    const match = /^( {0,3})(`{3,}|~{3,})/u.exec(line);

    if (match !== null) {
      const fence = match[2];
      if (fence === undefined) throw new Error('Fence capture is missing');
      const character = fence[0] as '`' | '~';
      if (openFence === null) {
        openFence = { character, length: fence.length, from: lineStart };
      } else if (
        character === openFence.character &&
        fence.length >= openFence.length &&
        line.slice(match[0].length).trim() === ''
      ) {
        ranges.push(
          sourceRange(openFence.from, newline === -1 ? lineEnd : lineEnd + 1),
        );
        openFence = null;
      }
    }

    if (newline === -1) break;
    lineStart = newline + 1;
  }

  if (openFence !== null) {
    ranges.push(sourceRange(openFence.from, source.length));
  }
  return ranges;
}

function findInlineCodeRanges(
  source: string,
  fencedRanges: readonly SourceRange[],
): SourceRange[] {
  const ranges: SourceRange[] = [];

  for (let index = 0; index < source.length; ) {
    if (
      source[index] !== '`' ||
      isEscaped(source, index) ||
      offsetIsInRanges(fencedRanges, index)
    ) {
      index += 1;
      continue;
    }

    const opener = readRun(source, index, '`');
    let cursor = opener.to;
    let closing: SourceRange | null = null;

    while (cursor < source.length) {
      if (offsetIsInRanges(fencedRanges, cursor)) {
        cursor += 1;
        continue;
      }
      if (source[cursor] !== '`' || isEscaped(source, cursor)) {
        cursor += 1;
        continue;
      }
      const candidate = readRun(source, cursor, '`');
      if (candidate.to - candidate.from === opener.to - opener.from) {
        closing = candidate;
        break;
      }
      cursor = candidate.to;
    }

    if (closing === null) {
      index = opener.to;
      continue;
    }
    ranges.push(sourceRange(opener.from, closing.to));
    index = closing.to;
  }

  return ranges;
}

function readRun(source: string, from: number, character: string): SourceRange {
  let to = from;
  while (source[to] === character) to += 1;
  return sourceRange(from, to);
}
