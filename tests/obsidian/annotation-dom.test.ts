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

  reconcileAnnotationDom(root, 'review');

  assert.equal(compact.classes.has('critic-focused'), false);
  assert.equal(expanded.classes.has('critic-focused'), true);
});

test('focuses compact fragments and clears stale focus idempotently', () => {
  const stale = fakeElement('stale', ['critic-annotation', 'critic-focused']);
  const range = fakeElement('review', ['critic-annotation']);
  const point = fakeElement('review', ['critic-inline-anchor']);
  const root = fakeRoot([stale, range, point]);

  reconcileAnnotationDom(root, 'review');
  reconcileAnnotationDom(root, 'review');

  assert.equal(stale.classes.has('critic-focused'), false);
  assert.equal(range.classes.has('critic-focused'), true);
  assert.equal(point.classes.has('critic-focused'), true);

  reconcileAnnotationDom(root, null);
  assert.equal(range.classes.has('critic-focused'), false);
  assert.equal(point.classes.has('critic-focused'), false);
});

test('marks only the syntax host that owns a Critic substitution', () => {
  const staleHost = fakeElement(undefined, [
    'cm-strikethrough',
    'critic-substitution-host',
  ]);
  const currentHost = fakeElement(undefined, ['cm-strikethrough']);
  const replacement = fakeElement('review', [
    'critic-annotation',
    'critic-annotation-replacement',
  ]);
  replacement.closestHost = currentHost;
  const root = fakeRoot([staleHost, currentHost, replacement]);

  reconcileAnnotationDom(root, null);
  reconcileAnnotationDom(root, null);

  assert.equal(staleHost.classes.has('critic-substitution-host'), false);
  assert.equal(currentHost.classes.has('critic-substitution-host'), true);
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

function fakeRoot(elements: readonly FakeElement[]): ParentNode {
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
  } as unknown as ParentNode;
}

function matches(element: FakeElement | undefined, selector: string): boolean {
  if (element === undefined) return false;
  return selector
    .split(',')
    .some(part => element.classes.has(part.trim().replace(/^\./u, '')));
}
