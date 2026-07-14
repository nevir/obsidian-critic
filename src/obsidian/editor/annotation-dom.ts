const ANNOTATION_SELECTOR = '.critic-annotation, .critic-inline-anchor';

export function reconcileAnnotationDom(
  root: ParentNode,
  focusedReviewId: string | null,
): void {
  const annotations = [
    ...root.querySelectorAll<HTMLElement>(ANNOTATION_SELECTOR),
  ];
  for (const annotation of annotations) {
    annotation.classList.remove('critic-focused');
  }

  if (focusedReviewId !== null) {
    const matching = annotations.filter(
      annotation => annotation.dataset['criticReviewId'] === focusedReviewId,
    );
    const expanded = matching.filter(annotation =>
      annotation.classList.contains('critic-annotation-expanded'),
    );
    for (const annotation of expanded.length > 0 ? expanded : matching) {
      annotation.classList.add('critic-focused');
    }
  }

  for (const host of root.querySelectorAll<HTMLElement>(
    '.critic-substitution-host',
  )) {
    host.classList.remove('critic-substitution-host');
  }
  for (const replacement of root.querySelectorAll<HTMLElement>(
    '.critic-annotation-replacement',
  )) {
    replacement
      .closest<HTMLElement>('.cm-strikethrough')
      ?.classList.add('critic-substitution-host');
  }
}
