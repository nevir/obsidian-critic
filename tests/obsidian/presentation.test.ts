import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCriticMarkup } from '../../src/core/syntax/index.ts';
import { buildReviewPresentations } from '../../src/obsidian/review/presentation.ts';

test('presents suggestion previews and lifecycle actions', () => {
  const reviews = parseCriticMarkup(
    '{++add++} {--remove--} {~~old~>new~~}{>>discussion<<}',
  ).reviews;

  assert.deepEqual(
    buildReviewPresentations(reviews).map(({ change, headerActions }) => ({
      change,
      headerActions,
    })),
    [
      {
        change: { original: null, proposed: 'add' },
        headerActions: ['reject', 'accept'],
      },
      {
        change: { original: 'remove', proposed: null },
        headerActions: ['reject', 'accept'],
      },
      {
        change: { original: 'old', proposed: 'new' },
        headerActions: ['reject', 'accept'],
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
      messages: [{ authorLabel: null, markdown: 'note' }],
      headerActions: ['resolve'],
    },
    {
      id: 'review-22',
      change: null,
      messages: [{ authorLabel: null, markdown: 'point' }],
      headerActions: ['resolve'],
    },
  ]);
});
