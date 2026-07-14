import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCriticMarkup } from '../../src/core/syntax/index.ts';
import {
  adjacentReviewId,
  reconcileFocusedReviewId,
} from '../../src/obsidian/review/navigation.ts';
import { buildReviewPresentations } from '../../src/obsidian/review/presentation.ts';

test('presents suggestion previews and lifecycle actions', () => {
  const reviews = parseCriticMarkup(
    '{++add++} {--remove--} {~~old~>new~~}{>>discussion<<}',
  ).reviews;

  assert.deepEqual(
    buildReviewPresentations(reviews).map(
      ({ change, headerActions, canResolveDiscussion }) => ({
        change,
        headerActions,
        canResolveDiscussion,
      }),
    ),
    [
      {
        change: { original: null, proposed: 'add' },
        headerActions: ['reject', 'accept'],
        canResolveDiscussion: false,
      },
      {
        change: { original: 'remove', proposed: null },
        headerActions: ['reject', 'accept'],
        canResolveDiscussion: false,
      },
      {
        change: { original: 'old', proposed: 'new' },
        headerActions: ['reject', 'accept'],
        canResolveDiscussion: true,
      },
    ],
  );
});

test('shows names globally and suppresses consecutive repeated authors', () => {
  const reviews = parseCriticMarkup(
    '{>>unnamed<<} {>>[Ian] one<<}{>>[Ian] two<<}{>>three<<}{>>[Ada]\nfour<<}',
  ).reviews;
  const presentations = buildReviewPresentations(reviews);

  assert.deepEqual(
    presentations.flatMap(review =>
      review.messages.map(message => message.authorLabel),
    ),
    ['You', 'Ian', null, 'You', 'Ada'],
  );
  assert.deepEqual(
    presentations.flatMap(review =>
      review.messages.map(message => message.markdown),
    ),
    ['unnamed', 'one', 'two', 'three', 'four'],
  );
});

test('omits all author labels when no comment names an author', () => {
  const reviews = parseCriticMarkup('{>>one<<}{>>two<<}').reviews;
  const messages = buildReviewPresentations(reviews)[0]?.messages;

  assert.deepEqual(
    messages?.map(message => message.authorLabel),
    [null, null],
  );
});

test('range and point comments resolve without a type title model', () => {
  const reviews = parseCriticMarkup(
    '{==range==}{>>note<<} {>>point<<}',
  ).reviews;

  assert.deepEqual(buildReviewPresentations(reviews), [
    {
      id: 'review-0',
      change: null,
      messages: [{ id: 'comment-11', authorLabel: null, markdown: 'note' }],
      headerActions: ['resolve'],
      canResolveDiscussion: false,
    },
    {
      id: 'review-22',
      change: null,
      messages: [{ id: 'comment-22', authorLabel: null, markdown: 'point' }],
      headerActions: ['resolve'],
      canResolveDiscussion: false,
    },
  ]);
});

test('navigation is bounded and only operates from an existing focus', () => {
  const ids = ['a', 'b', 'c'];

  assert.equal(adjacentReviewId(ids, null, 1), null);
  assert.equal(adjacentReviewId(ids, 'missing', 1), null);
  assert.equal(adjacentReviewId(ids, 'a', -1), null);
  assert.equal(adjacentReviewId(ids, 'a', 1), 'b');
  assert.equal(adjacentReviewId(ids, 'c', 1), null);
});

test('focus reconciliation chooses the next item, then the previous item', () => {
  assert.equal(reconcileFocusedReviewId(['a', 'b', 'c'], ['a', 'c'], 'b'), 'c');
  assert.equal(reconcileFocusedReviewId(['a', 'b', 'c'], ['a', 'b'], 'c'), 'b');
  assert.equal(reconcileFocusedReviewId(['a'], [], 'a'), null);
  assert.equal(reconcileFocusedReviewId(['a'], ['a'], 'a'), 'a');
});
