import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReviewItem } from '../../src/core/model.ts';
import {
  acceptReview,
  applySourceEdits,
  rejectReview,
  resolveReview,
} from '../../src/core/mutations.ts';
import { parseCriticMarkup } from '../../src/core/syntax/index.ts';

const decisions = [
  ['before{++ after++}', 'before after', 'before'],
  ['keep{-- remove--}', 'keep', 'keep remove'],
  ['{~~old~>new~~}', 'new', 'old'],
  ['{++new++}{>>discussion<<}', 'new', ''],
  ['{--old--}{>>discussion<<}', '', 'old'],
  ['{~~old~>new~~}{>>discussion<<}', 'new', 'old'],
] as const;

test('accepts and rejects every suggestion shape atomically', () => {
  for (const [source, accepted, rejected] of decisions) {
    const review = firstReview(source);
    assert.equal(applySourceEdits(source, [acceptReview(review)]), accepted);
    assert.equal(applySourceEdits(source, [rejectReview(review)]), rejected);
  }
});

test('resolves range and point comments without changing accepted prose', () => {
  const rangeSource = 'Before {==target==}{>>one<<}{>>two<<} after.';
  const rangeReview = firstReview(rangeSource);
  const rangeEdit = resolveReview(rangeReview);
  assert.ok(rangeEdit !== null);
  assert.equal(
    applySourceEdits(rangeSource, [rangeEdit]),
    'Before target after.',
  );

  const pointSource = 'Before.{>>one<<}{>>two<<} After.';
  const pointReview = firstReview(pointSource);
  const pointEdit = resolveReview(pointReview);
  assert.ok(pointEdit !== null);
  assert.equal(applySourceEdits(pointSource, [pointEdit]), 'Before. After.');
});

test('resolves a suggestion discussion without deciding the suggestion', () => {
  const source = '{~~old~>new~~}{>>one<<}{>>two<<}';
  const review = firstReview(source);
  const edit = resolveReview(review);
  assert.ok(edit !== null);
  assert.equal(applySourceEdits(source, [edit]), '{~~old~>new~~}');

  const bare = firstReview('{++new++}');
  assert.equal(resolveReview(bare), null);
});

test('decisions decode Critic escapes but preserve ordinary backslashes', () => {
  const source = String.raw`{++literal \++} and \\ path++}`;
  const review = firstReview(source);
  assert.equal(
    applySourceEdits(source, [acceptReview(review)]),
    String.raw`literal ++} and \\ path`,
  );
});

test('rejects decisions that do not match the review kind', () => {
  const comment = firstReview('{>>comment<<}');
  assert.throws(() => acceptReview(comment), TypeError);
  assert.throws(() => rejectReview(comment), TypeError);
});

test('applies multiple edits from right to left', () => {
  const source = '0123456789';
  const result = applySourceEdits(source, [
    { from: 2, to: 4, insert: 'ab' },
    { from: 7, to: 9, insert: 'xy' },
  ]);
  assert.equal(result, '01ab456xy9');
});

test('rejects overlapping and out-of-bounds edits', () => {
  assert.throws(
    () =>
      applySourceEdits('abcdef', [
        { from: 1, to: 4, insert: '' },
        { from: 3, to: 5, insert: '' },
      ]),
    /must not overlap/u,
  );
  for (const edit of [
    { from: -1, to: 0, insert: '' },
    { from: 2, to: 1, insert: '' },
    { from: 0, to: 7, insert: '' },
    { from: 0.5, to: 1, insert: '' },
  ]) {
    assert.throws(
      () => applySourceEdits('abcdef', [edit]),
      /Invalid source edit/u,
    );
  }
});

test('generated payloads round-trip through both decision paths', () => {
  const payloads = [
    '',
    'plain',
    ' leading and trailing ',
    '\n\n',
    '**Markdown** and `code`',
    String.raw`literal \++}`,
    String.raw`ordinary \\ slash`,
  ];

  for (const payload of payloads) {
    const addition = `{++${payload}++}`;
    const additionReview = firstReview(addition);
    assert.equal(
      applySourceEdits(addition, [acceptReview(additionReview)]),
      additionReview.mark?.kind === 'addition'
        ? additionReview.mark.content
        : undefined,
    );
    assert.equal(
      applySourceEdits(addition, [rejectReview(additionReview)]),
      '',
    );

    const deletion = `{--${payload}--}`;
    const deletionReview = firstReview(deletion);
    assert.equal(
      applySourceEdits(deletion, [acceptReview(deletionReview)]),
      '',
    );
    assert.equal(
      applySourceEdits(deletion, [rejectReview(deletionReview)]),
      deletionReview.mark?.kind === 'deletion'
        ? deletionReview.mark.content
        : undefined,
    );
  }
});

function firstReview(source: string): ReviewItem {
  const review = parseCriticMarkup(source).reviews[0];
  assert.ok(review !== undefined, source);
  return review;
}
