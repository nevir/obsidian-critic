import assert from 'node:assert/strict';
import test from 'node:test';

import type { CommentMark, SourceRange } from '../../../src/core/model.ts';
import { parseCriticMarkup } from '../../../src/core/syntax/index.ts';

const canonicalCases = [
  ['before{++ after++}', 'addition', ' after'],
  ['keep{-- remove--}', 'deletion', ' remove'],
  ['{==target==}', 'highlight', 'target'],
] as const;

test('parses canonical single-payload marks with exact ranges', () => {
  for (const [source, kind, content] of canonicalCases) {
    const parsed = parseCriticMarkup(source);
    assert.equal(parsed.marks.length, 1);
    const mark = parsed.marks[0];
    assert.ok(mark !== undefined && mark.kind === kind);
    assert.equal(mark.content, content);
    assert.equal(slice(source, mark.source), source.slice(source.indexOf('{')));
    assert.equal(slice(source, mark.contentRange), content);
    assert.equal(parsed.reviews.length, 1);
  }
});

test('parses substitutions without losing either side', () => {
  const source = 'Use {~~**old**~>*new*~~} here.';
  const parsed = parseCriticMarkup(source);
  const mark = parsed.marks[0];
  assert.ok(mark?.kind === 'substitution');
  assert.equal(mark.original, '**old**');
  assert.equal(mark.replacement, '*new*');
  assert.equal(slice(source, mark.originalRange), '**old**');
  assert.equal(slice(source, mark.separator), '~>');
  assert.equal(slice(source, mark.replacementRange), '*new*');
});

test('preserves whitespace and multiline edit payloads', () => {
  const sources = [
    'first.{++\n\n++}second.',
    'first.{--\n\n--}second.',
    'first.{~~\n\n~> ~~}second.',
  ];
  const parsed = sources.map(source => parseCriticMarkup(source).marks[0]);
  assert.ok(parsed[0]?.kind === 'addition');
  assert.equal(parsed[0].content, '\n\n');
  assert.ok(parsed[1]?.kind === 'deletion');
  assert.equal(parsed[1].content, '\n\n');
  assert.ok(parsed[2]?.kind === 'substitution');
  assert.equal(parsed[2].original, '\n\n');
  assert.equal(parsed[2].replacement, ' ');
});

test('parses inline and block author prefixes without inheriting authors', () => {
  const source =
    '{>>[Ian] First<<}{>>Unattributed<<}{>>[Cheesecat Studio]\n**Rich** body.<<}';
  const parsed = parseCriticMarkup(source);
  const comments = parsed.marks.filter(
    (mark): mark is CommentMark => mark.kind === 'comment',
  );
  assert.deepEqual(
    comments.map(comment => [comment.author, comment.body]),
    [
      ['Ian', 'First'],
      [null, 'Unattributed'],
      ['Cheesecat Studio', '**Rich** body.'],
    ],
  );
});

test('groups only exactly adjacent comments into threads', () => {
  const adjacent = parseCriticMarkup('text.{>>one<<}{>>two<<}{>>three<<}');
  assert.equal(adjacent.reviews.length, 1);
  assert.equal(adjacent.reviews[0]?.messages.length, 3);
  assert.equal(adjacent.reviews[0]?.point, true);

  const separated = parseCriticMarkup('text.{>>one<<} {>>two<<}\n{>>three<<}');
  assert.equal(separated.reviews.length, 3);
  assert.deepEqual(
    separated.reviews.map(review => review.messages.length),
    [1, 1, 1],
  );
});

test('attaches adjacent threads to highlights and suggestions', () => {
  const source = '{==range==}{>>one<<}{>>two<<} and {~~old~>new~~}{>>why<<}';
  const parsed = parseCriticMarkup(source);
  assert.equal(parsed.reviews.length, 2);
  const [rangeReview, suggestionReview] = parsed.reviews;
  assert.equal(rangeReview?.kind, 'comment');
  assert.equal(rangeReview?.mark?.kind, 'highlight');
  assert.equal(rangeReview?.messages.length, 2);
  assert.equal(suggestionReview?.kind, 'suggestion');
  assert.equal(suggestionReview?.messages.length, 1);
});

test('decodes only Critic-layer delimiter escapes', () => {
  const source = String.raw`{>>literal \<<} and \{++ and \\ path<<}`;
  const parsed = parseCriticMarkup(source);
  const comment = parsed.marks[0];
  assert.ok(comment?.kind === 'comment');
  assert.equal(comment.body, String.raw`literal <<} and {++ and \\ path`);

  assert.equal(parseCriticMarkup(String.raw`\{>>literal<<}`).marks.length, 0);
  const even = parseCriticMarkup(String.raw`\\{>>live<<}`);
  assert.equal(even.marks.length, 1);
  assert.equal(even.marks[0]?.source.from, 2);
});

test('ignores Critic-looking text in inline code and fenced code blocks', () => {
  const source = [
    '`{>>inline<<}` and ``code `{++also++}` code``',
    '',
    '```markdown',
    '{==fenced==}{>>not live<<}',
    '```',
    '',
    'Live {++addition++}.',
  ].join('\n');
  const parsed = parseCriticMarkup(source);
  assert.deepEqual(
    parsed.marks.map(candidate => candidate.kind),
    ['addition'],
  );
  const mark = parsed.marks[0];
  assert.ok(mark?.kind === 'addition');
  assert.equal(mark.content, 'addition');
});

test('supports tilde fences and longer closing fences', () => {
  const source = '~~~~text\n{--not live--}\n~~~~~\n{--live--}';
  const parsed = parseCriticMarkup(source);
  assert.equal(parsed.marks.length, 1);
  assert.equal(parsed.marks[0]?.kind, 'deletion');
});

test('keeps malformed and nested candidates non-actionable', () => {
  const malformed = [
    'Broken {++never closes',
    'Later {++works++}.',
    '{~~missing separator~~}',
    '{~~too~>many~>separators~~}',
    '{==outer {++nested++} target==}',
  ].join('\n');
  const parsed = parseCriticMarkup(malformed);
  assert.deepEqual(
    parsed.marks.map(candidate => candidate.kind),
    ['addition'],
  );
  const mark = parsed.marks[0];
  assert.ok(mark?.kind === 'addition');
  assert.equal(mark.content, 'works');
});

test('recognizes reviews inside representative Markdown constructs', () => {
  const source = [
    '| Status | Detail |',
    '| --- | --- |',
    '| {==open==}{>>table<<} | {++new++} |',
    '- [ ] {~~Old task~>New task~~}',
    '> [!NOTE] {--Remove this--}',
    '![{==alt==}{>>image text<<}](image.png)',
    '[{==label==}{>>link text<<}](https://example.com)',
  ].join('\n');
  const parsed = parseCriticMarkup(source);
  assert.deepEqual(
    parsed.reviews.map(review => review.mark?.kind),
    [
      'highlight',
      'addition',
      'substitution',
      'deletion',
      'highlight',
      'highlight',
    ],
  );
});

function slice(source: string, range: SourceRange): string {
  return source.slice(range.from, range.to);
}
