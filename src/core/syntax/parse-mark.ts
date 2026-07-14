import type {
  CommentMark,
  CriticMark,
  SourceRange,
  SubstitutionMark,
} from '../model';
import { decodeCriticEscapes, isEscaped } from './escapes';
import { sourceRange } from './ranges';

interface Syntax {
  readonly kind: CriticMark['kind'];
  readonly opener: string;
  readonly closer: string;
}

export interface MarkParseResult {
  readonly mark: CriticMark | null;
  readonly nextOffset: number;
}

const SYNTAXES: readonly Syntax[] = [
  { kind: 'addition', opener: '{++', closer: '++}' },
  { kind: 'deletion', opener: '{--', closer: '--}' },
  { kind: 'substitution', opener: '{~~', closer: '~~}' },
  { kind: 'comment', opener: '{>>', closer: '<<}' },
  { kind: 'highlight', opener: '{==', closer: '==}' },
];

export function syntaxAt(source: string, offset: number): Syntax | null {
  if (isEscaped(source, offset)) return null;
  return (
    SYNTAXES.find(syntax => source.startsWith(syntax.opener, offset)) ?? null
  );
}

export function parseMarkAt(source: string, from: number): MarkParseResult {
  const syntax = syntaxAt(source, from);
  if (syntax === null) return { mark: null, nextOffset: from + 1 };

  const contentFrom = from + syntax.opener.length;
  const closerFrom = findUnescapedToken(source, syntax.closer, contentFrom);
  if (closerFrom === -1) {
    return { mark: null, nextOffset: malformedRegionEnd(source, contentFrom) };
  }

  const nestedFrom = findNestedOpener(source, contentFrom, closerFrom);
  const sourceTo = closerFrom + syntax.closer.length;
  if (nestedFrom !== -1) {
    const nestedStartsInLaterRegion = source
      .slice(contentFrom, nestedFrom)
      .includes('\n');
    return {
      mark: null,
      nextOffset: nestedStartsInLaterRegion ? nestedFrom : sourceTo,
    };
  }

  const markRange = sourceRange(from, sourceTo);
  const opener = sourceRange(from, contentFrom);
  const closer = sourceRange(closerFrom, sourceTo);

  if (syntax.kind === 'substitution') {
    const mark = parseSubstitution(
      source,
      markRange,
      opener,
      closer,
      contentFrom,
      closerFrom,
    );
    return { mark, nextOffset: sourceTo };
  }

  const contentRange = sourceRange(contentFrom, closerFrom);
  const content = decodeCriticEscapes(source.slice(contentFrom, closerFrom));
  const id = markId(syntax.kind, from);

  if (syntax.kind === 'comment') {
    return {
      mark: parseComment(
        source,
        id,
        markRange,
        opener,
        closer,
        contentRange,
        content,
      ),
      nextOffset: sourceTo,
    };
  }

  return {
    mark: {
      id,
      kind: syntax.kind,
      source: markRange,
      opener,
      closer,
      content,
      contentRange,
    },
    nextOffset: sourceTo,
  };
}

function parseSubstitution(
  source: string,
  markSource: SourceRange,
  opener: SourceRange,
  closer: SourceRange,
  contentFrom: number,
  contentTo: number,
): SubstitutionMark | null {
  const separatorFrom = findUnescapedToken(
    source,
    '~>',
    contentFrom,
    contentTo,
  );
  if (separatorFrom === -1) return null;
  const extraSeparator = findUnescapedToken(
    source,
    '~>',
    separatorFrom + 2,
    contentTo,
  );
  if (extraSeparator !== -1) return null;

  const originalRange = sourceRange(contentFrom, separatorFrom);
  const replacementRange = sourceRange(separatorFrom + 2, contentTo);
  return {
    id: markId('substitution', markSource.from),
    kind: 'substitution',
    source: markSource,
    opener,
    closer,
    separator: sourceRange(separatorFrom, separatorFrom + 2),
    original: decodeCriticEscapes(
      source.slice(originalRange.from, originalRange.to),
    ),
    originalRange,
    replacement: decodeCriticEscapes(
      source.slice(replacementRange.from, replacementRange.to),
    ),
    replacementRange,
  };
}

function parseComment(
  source: string,
  id: string,
  markSource: SourceRange,
  opener: SourceRange,
  closer: SourceRange,
  payloadRange: SourceRange,
  payload: string,
): CommentMark {
  const authorMatch = /^\[([^\u005d\n]+)\](?: |\n)/u.exec(payload);
  const headerLength = authorMatch?.[0].length ?? 0;
  const bodyRange = sourceRange(
    payloadRange.from + headerLength,
    payloadRange.to,
  );
  return {
    id,
    kind: 'comment',
    source: markSource,
    opener,
    closer,
    author: authorMatch?.[1] ?? null,
    body: decodeCriticEscapes(source.slice(bodyRange.from, bodyRange.to)),
    bodyRange,
    payload,
    payloadRange,
  };
}

function findUnescapedToken(
  source: string,
  token: string,
  from: number,
  to = source.length,
): number {
  let offset = source.indexOf(token, from);
  while (offset !== -1 && offset < to) {
    if (!isEscaped(source, offset)) return offset;
    offset = source.indexOf(token, offset + token.length);
  }
  return -1;
}

function findNestedOpener(source: string, from: number, to: number): number {
  for (let offset = from; offset < to; offset += 1) {
    if (syntaxAt(source, offset) !== null) return offset;
  }
  return -1;
}

function malformedRegionEnd(source: string, from: number): number {
  const newline = source.indexOf('\n', from);
  return newline === -1 ? source.length : newline + 1;
}

function markId(kind: CriticMark['kind'], from: number): string {
  return `${kind}-${from}`;
}
