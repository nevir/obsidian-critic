import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileAnnotationDom } from '../../src/obsidian/editor/annotation-dom.ts';

test('focuses only expanded fragments when source is exposed', () => {
  const compact = fakeElement('review', ['critic-annotation']);
  const expanded = fakeElement('review', [
    'critic-annotation',
    'critic-annotation-expanded',
  ]);
  const root = fakeRoot([compact, expanded]);

  reconcileAnnotationDom(root as unknown as ParentNode, 'review');

  assert.equal(compact.classes.has('critic-focused'), false);
  assert.equal(expanded.classes.has('critic-focused'), true);
});

test('marks only the syntax host that owns a Critic substitution', () => {
  const host = fakeElement(undefined, ['cm-strikethrough']);
  const replacement = fakeElement('review', [
    'critic-annotation',
    'critic-annotation-replacement',
  ]);
  replacement.closestHost = host;
  const root = fakeRoot([host, replacement]);

  reconcileAnnotationDom(root as unknown as ParentNode, null);
  reconcileAnnotationDom(root as unknown as ParentNode, null);

  assert.equal(host.classes.has('critic-substitution-host'), true);
});

interface FakeElement {
  readonly reviewId: string | undefined;
  readonly classes: Set<string>;
  closestHost: FakeElement | null;
}

function fakeElement(
  reviewId: string | undefined,
  classes: readonly string[],
): FakeElement {
  return { reviewId, classes: new Set(classes), closestHost: null };
}

function fakeRoot(elements: readonly FakeElement[]) {
  const domElements = elements.map(element => ({
    dataset: { criticReviewId: element.reviewId },
    classList: {
      add: (...classes: string[]) => {
        for (const value of classes) element.classes.add(value);
      },
      contains: (value: string) => element.classes.has(value),
      remove: (...classes: string[]) => {
        for (const value of classes) element.classes.delete(value);
      },
    },
    closest: (selector: string) =>
      selector === '.cm-strikethrough' && element.closestHost !== null
        ? domElements[elements.indexOf(element.closestHost)]
        : null,
  }));
  return {
    querySelectorAll: (selector: string) =>
      domElements.filter((_, index) => matches(elements[index], selector)),
  };
}

function matches(element: FakeElement | undefined, selector: string): boolean {
  if (element === undefined) return false;
  return selector
    .split(',')
    .some(part => element.classes.has(part.trim().replace(/^\./u, '')));
}
