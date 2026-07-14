import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCriticMarkup } from '../../src/core/syntax/index.ts';
import {
  buildDecorationSpecs,
  type DecorationSpec,
} from '../../src/obsidian/editor/decoration-specs.ts';

test('maps every canonical mark to compact visible content', () => {
  const source =
    '{++add++} {--delete--} {~~old~>new~~} {==range==}{>>note<<} {>>point<<}';
  const specs = buildDecorationSpecs(parseCriticMarkup(source));

  assert.deepEqual(markClasses(specs), [
    'addition',
    'deletion',
    'original',
    'replacement',
    'highlight',
  ]);
  assert.equal(specs.filter(spec => spec.kind === 'replace').length, 10);
  assert.deepEqual(
    specs.filter(spec => spec.kind === 'separator'),
    [{ kind: 'separator', from: 29, to: 31 }],
  );
  assert.deepEqual(
    specs.filter(spec => spec.kind === 'widget'),
    [{ kind: 'widget', at: 60, reviewId: 'review-60', role: 'point' }],
  );
});

test('uses one point widget for an adjacent thread', () => {
  const document = parseCriticMarkup('{>>[Ian] one<<}{>>two<<}{>>three<<}');
  const specs = buildDecorationSpecs(document);

  assert.equal(document.reviews.length, 1);
  assert.equal(specs.filter(spec => spec.kind === 'replace').length, 3);
  assert.deepEqual(
    specs.filter(spec => spec.kind === 'widget'),
    [{ kind: 'widget', at: 0, reviewId: 'review-0', role: 'point' }],
  );
});

test('keeps selected CriticMarkup source directly editable as one expression', () => {
  const source = 'before {~~old~>new~~}{>>why<<} after';
  const document = parseCriticMarkup(source);
  const review = document.reviews[0];
  assert.ok(review);

  const compact = buildDecorationSpecs(document);
  const selected = buildDecorationSpecs(document, [
    { from: source.indexOf('why'), to: source.indexOf('why') },
  ]);

  assert.equal(compact.filter(spec => spec.kind === 'replace').length, 3);
  assert.deepEqual(
    compact.filter(spec => spec.kind === 'separator'),
    [{ kind: 'separator', from: 13, to: 15 }],
  );
  assert.deepEqual(markClasses(selected), [
    'expanded',
    'original',
    'replacement',
  ]);
  assert.deepEqual(selected[0], {
    kind: 'mark',
    from: review.source.from,
    to: review.source.to,
    annotationClass: 'expanded',
    reviewId: review.id,
  });
  const mark = review.mark;
  assert.ok(mark?.kind === 'substitution');
  assert.deepEqual(
    selected.filter(spec => spec.kind === 'syntax'),
    [
      {
        kind: 'syntax',
        from: mark.opener.to - 2,
        to: mark.opener.to,
        reviewId: review.id,
        text: '~~',
        placement: 'after',
      },
      {
        kind: 'syntax',
        from: mark.closer.from,
        to: mark.closer.from + 2,
        reviewId: review.id,
        text: '~~',
        placement: 'before',
      },
    ],
  );
  assert.equal(
    selected.some(spec => spec.kind === 'replace'),
    false,
  );
  assert.equal(
    selected.some(spec => spec.kind === 'separator'),
    false,
  );
});

test('yields stable syntax pairs when the selection enters them', () => {
  const source = '{==highlight==}{>>note<<} {~~old~>new~~}';
  const document = parseCriticMarkup(source);
  const highlight = document.reviews[0];
  const substitution = document.reviews[1];
  assert.ok(highlight?.mark?.kind === 'highlight');
  assert.ok(substitution?.mark?.kind === 'substitution');

  const highlightSpecs = buildDecorationSpecs(document, [
    { from: highlight.mark.opener.to - 1, to: highlight.mark.opener.to - 1 },
  ]);
  assert.deepEqual(
    highlightSpecs.filter(spec => spec.kind === 'syntax'),
    [
      {
        kind: 'syntax',
        from: highlight.mark.closer.from,
        to: highlight.mark.closer.from + 2,
        reviewId: highlight.id,
        text: '==',
        placement: 'before',
      },
    ],
  );

  const substitutionSpecs = buildDecorationSpecs(document, [
    {
      from: substitution.mark.originalRange.from,
      to: substitution.mark.originalRange.from,
    },
  ]);
  assert.equal(
    substitutionSpecs.filter(spec => spec.kind === 'syntax').length,
    2,
  );
});

test('does not stabilize syntax without Markdown-reserved delimiter pairs', () => {
  const source = '{++add++} {--delete--} {>>comment<<}';
  const document = parseCriticMarkup(source);

  for (const review of document.reviews) {
    const specs = buildDecorationSpecs(document, [
      { from: review.source.from + 1, to: review.source.from + 1 },
    ]);
    assert.equal(
      specs.some(spec => spec.kind === 'syntax'),
      false,
    );
  }
});

test('keeps an expanded point discussion anchored to its full source', () => {
  const source = 'before {>>[Ian] note<<} after';
  const document = parseCriticMarkup(source);
  const review = document.reviews[0];
  assert.ok(review);

  const selected = buildDecorationSpecs(document, [
    { from: source.indexOf('note'), to: source.indexOf('note') },
  ]);

  assert.deepEqual(selected, [
    {
      kind: 'mark',
      from: review.source.from,
      to: review.source.to,
      annotationClass: 'expanded',
      reviewId: review.id,
    },
  ]);
});

test('does not expose a review when the caret sits immediately after it', () => {
  const source = '{++text++} after';
  const document = parseCriticMarkup(source);
  const specs = buildDecorationSpecs(document, [{ from: 10, to: 10 }]);

  assert.equal(specs.filter(spec => spec.kind === 'replace').length, 2);
});

test('creates stable widgets for empty annotations', () => {
  const document = parseCriticMarkup('{++++} {~~~>~~} {====}{>>range<<}');
  const specs = buildDecorationSpecs(document);

  assert.deepEqual(
    specs.filter(spec => spec.kind === 'widget'),
    [
      { kind: 'widget', at: 3, reviewId: 'review-0', role: 'empty' },
      { kind: 'widget', at: 10, reviewId: 'review-7', role: 'empty' },
      { kind: 'widget', at: 19, reviewId: 'review-16', role: 'empty' },
    ],
  );
});

test('inherits parser exclusions inside representative Markdown constructs', () => {
  const source = [
    '| Task | Review |',
    '| --- | --- |',
    '| - [ ] ship | {++today++} |',
    '',
    '`{--code--}`',
    '',
    '> [!note] {==callout==}{>>check this<<}',
  ].join('\n');
  const specs = buildDecorationSpecs(parseCriticMarkup(source));

  assert.deepEqual(markClasses(specs), ['addition', 'highlight']);
});

function markClasses(specs: readonly DecorationSpec[]) {
  return specs.flatMap(spec =>
    spec.kind === 'mark' ? [spec.annotationClass] : [],
  );
}
