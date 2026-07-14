import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareReadingDocument } from '../../src/obsidian/reading/document-projection.ts';

test('prepares Original and Proposed document Markdown', () => {
  assert.deepEqual(prepareReadingDocument('A {~~old~>new~~}.', 'original'), {
    markdown: 'A old.',
    projected: 'A old.',
  });
  assert.deepEqual(prepareReadingDocument('A {~~old~>new~~}.', 'proposed'), {
    markdown: 'A new.',
    projected: 'A new.',
  });
});

test('leaves review-free and code-excluded documents to Obsidian', () => {
  assert.equal(prepareReadingDocument('Ordinary Markdown.', 'original'), null);
  assert.equal(prepareReadingDocument('`{>>literal<<}`', 'proposed'), null);
});
