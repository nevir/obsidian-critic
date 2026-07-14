import type { CriticMark, ParsedDocument } from '../model';
import { findCodeRanges, offsetIsInRanges } from './markdown-context';
import { parseMarkAt, syntaxAt } from './parse-mark';
import { buildReviews } from './reviews';

export function parseCriticMarkup(source: string): ParsedDocument {
  const excludedRanges = findCodeRanges(source);
  const marks: CriticMark[] = [];

  for (let offset = 0; offset < source.length; ) {
    if (
      offsetIsInRanges(excludedRanges, offset) ||
      syntaxAt(source, offset) === null
    ) {
      offset += 1;
      continue;
    }

    const result = parseMarkAt(source, offset);
    if (result.mark !== null) marks.push(result.mark);
    offset = Math.max(offset + 1, result.nextOffset);
  }

  return { source, marks, reviews: buildReviews(marks) };
}
