import assert from 'node:assert/strict';
import test from 'node:test';

import { projectCriticMarkup } from '../../src/core/projection.ts';

test('projects every review shape to original and proposed Markdown', () => {
  const source = [
    'Addition: {++new++}{>>discussion<<}',
    'Deletion: {--old--}{>>discussion<<}',
    'Replacement: {~~before~>after~~}{>>discussion<<}',
    'Range: {==target==}{>>one<<}{>>two<<}',
    'Point.{>>one<<}{>>two<<}',
    'Separated.{>>one<<} {>>two<<}',
  ].join('\n');

  assert.equal(
    projectCriticMarkup(source, 'original'),
    [
      'Addition: ',
      'Deletion: old',
      'Replacement: before',
      'Range: target',
      'Point.',
      'Separated. ',
    ].join('\n'),
  );
  assert.equal(
    projectCriticMarkup(source, 'proposed'),
    [
      'Addition: new',
      'Deletion: ',
      'Replacement: after',
      'Range: target',
      'Point.',
      'Separated. ',
    ].join('\n'),
  );
});

test('preserves Markdown constructs while projecting their review payloads', () => {
  const source = [
    '| Surface | Value |',
    '| --- | --- |',
    '| Table | {~~Editing~>Suggesting~~} |',
    '- [ ] Task with {==a comment==}{>>check this<<}',
    '> [!info] Callout with {++**strong**++}',
    'A {~~[stale](old.md)~>[current](new.md)~~} link.',
    'Image: {==![](image.png)==}{>>whole image<<}',
  ].join('\n');

  assert.equal(
    projectCriticMarkup(source, 'original'),
    [
      '| Surface | Value |',
      '| --- | --- |',
      '| Table | Editing |',
      '- [ ] Task with a comment',
      '> [!info] Callout with ',
      'A [stale](old.md) link.',
      'Image: ![](image.png)',
    ].join('\n'),
  );
  assert.equal(
    projectCriticMarkup(source, 'proposed'),
    [
      '| Surface | Value |',
      '| --- | --- |',
      '| Table | Suggesting |',
      '- [ ] Task with a comment',
      '> [!info] Callout with **strong**',
      'A [current](new.md) link.',
      'Image: ![](image.png)',
    ].join('\n'),
  );
});

test('decodes chosen payloads without activating excluded or invalid syntax', () => {
  const source = [
    String.raw`Escaped choice: {~~old~>literal \~~} value~~}`,
    String.raw`Literal opener: \{>>documentation<<}`,
    'Inline code: `{++not live++}`',
    '```markdown',
    '{--not live--}',
    '```',
    'Malformed: {++never closed',
  ].join('\n');

  assert.equal(
    projectCriticMarkup(source, 'proposed'),
    [
      'Escaped choice: literal ~~} value',
      String.raw`Literal opener: \{>>documentation<<}`,
      'Inline code: `{++not live++}`',
      '```markdown',
      '{--not live--}',
      '```',
      'Malformed: {++never closed',
    ].join('\n'),
  );
});

test('is deterministic and leaves review-free source unchanged', () => {
  const source = '# Heading\n\nOrdinary **Markdown**.\n';
  assert.equal(projectCriticMarkup(source, 'original'), source);
  assert.equal(projectCriticMarkup(source, 'proposed'), source);
});
