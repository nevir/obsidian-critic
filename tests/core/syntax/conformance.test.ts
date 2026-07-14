import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCriticMarkup } from '../../../src/core/syntax/index.ts';

const conformanceDocument = [
  'Inline addition: before{++ after++}.',
  'Inline deletion: keep{-- remove--}.',
  'Inline substitution: {~~old~>new~~}.',
  'Point comment: text.{>>comment<<}',
  'Point thread: text.{>>one<<}{>>two<<}',
  'Separated point comments: text.{>>one<<} {>>two<<}',
  'Range thread: {==target==}{>>one<<}{>>two<<}',
  'Suggestion thread: {++new++}{>>one<<}{>>two<<}',
  'Attributed thread: {==target==}{>>[Ian] one<<}{>>[Agent] two<<}',
  'Attributed block message: {>>[Ian]',
  'First paragraph.',
  '',
  '- One item.',
  '- Another item.',
  '<<}',
  'Formatting replacement: {~~**bold**~>*italic*~~}',
  'Paragraph insertion: first.{++',
  '',
  '++}second.',
  'Paragraph deletion: first.{--',
  '',
  '--}second.',
  'Paragraph substitution: first.{~~',
  '',
  '~> ~~}second.',
  String.raw`Escaped opening token: \{>>literal syntax<<}`,
  String.raw`Escaped closing token: {>>The literal closer is \<<}.<<}`,
  'Malformed mark: text {++never closed.',
  'Inline-code example: `{>>not live<<}`',
  'Fenced-code example:',
  '```text',
  '{>>not live<<}',
  '```',
].join('\n');

test('parses the complete canonical project conformance document', () => {
  const parsed = parseCriticMarkup(conformanceDocument);
  assert.deepEqual(
    parsed.marks.map(mark => mark.kind),
    [
      'addition',
      'deletion',
      'substitution',
      'comment',
      'comment',
      'comment',
      'comment',
      'comment',
      'highlight',
      'comment',
      'comment',
      'addition',
      'comment',
      'comment',
      'highlight',
      'comment',
      'comment',
      'comment',
      'substitution',
      'addition',
      'deletion',
      'substitution',
      'comment',
    ],
  );
  assert.equal(parsed.reviews.length, 16);
  assert.deepEqual(
    parsed.reviews.map(review => review.messages.length),
    [0, 0, 0, 1, 2, 1, 1, 2, 2, 2, 1, 0, 0, 0, 0, 1],
  );
});

test('parsing is deterministic and preserves the complete source', () => {
  const first = parseCriticMarkup(conformanceDocument);
  const second = parseCriticMarkup(conformanceDocument);
  assert.equal(first.source, conformanceDocument);
  assert.deepEqual(second, first);
});

test('handles large notes without state leaking between candidates', () => {
  const paragraph =
    'Ordinary prose with `code {>>literal<<}` and no review.\n\n';
  const source = `${paragraph.repeat(2000)}{==Final target==}{>>Final comment.<<}`;
  const parsed = parseCriticMarkup(source);
  assert.equal(parsed.reviews.length, 1);
  assert.equal(parsed.reviews[0]?.mark?.kind, 'highlight');
  assert.equal(parsed.reviews[0]?.messages[0]?.body, 'Final comment.');
});
