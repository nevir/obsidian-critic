import type { NavigationDirection } from './navigation';
import type { ReviewAction, ReviewPresentation } from './presentation';

export function renderCardHeader(
  presentation: ReviewPresentation,
  showNavigation: boolean,
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'critic-card-header';

  const position = document.createElement('span');
  position.className = 'critic-card-position';
  header.append(position);

  if (showNavigation) header.append(renderNavigation());

  const actions = document.createElement('div');
  actions.className = 'critic-card-actions';
  if (presentation.headerActions.length === 1) {
    const placeholder = document.createElement('span');
    placeholder.className = 'critic-card-action-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    actions.append(placeholder);
  }
  for (const action of presentation.headerActions) {
    actions.append(actionButton(action));
  }
  header.append(actions);
  return header;
}

export function updateCardSequence(
  card: HTMLElement,
  index: number,
  total: number,
): void {
  const position = card.querySelector('.critic-card-position');
  if (position !== null) position.textContent = `${index + 1}/${total}`;
  for (const button of card.querySelectorAll<HTMLButtonElement>(
    '[data-critic-navigation]',
  )) {
    const direction = navigationDirection(button.dataset['criticNavigation']);
    if (direction === null) continue;
    button.disabled = direction === -1 ? index === 0 : index === total - 1;
  }
}

export function cardActionFromEvent(event: MouseEvent): ReviewAction | null {
  if (!(event.target instanceof Element)) return null;
  const action = event.target.closest<HTMLElement>('[data-critic-action]')
    ?.dataset['criticAction'];
  return action === 'accept' || action === 'reject' || action === 'resolve'
    ? action
    : null;
}

export function cardNavigationFromEvent(
  event: MouseEvent,
): NavigationDirection | null {
  if (!(event.target instanceof Element)) return null;
  return navigationDirection(
    event.target.closest<HTMLElement>('[data-critic-navigation]')?.dataset[
      'criticNavigation'
    ],
  );
}

function renderNavigation(): HTMLElement {
  const navigation = document.createElement('nav');
  navigation.className = 'critic-card-navigation';
  navigation.setAttribute('aria-label', 'Review navigation');
  navigation.append(
    navigationButton(-1, 'Previous review', '←'),
    navigationButton(1, 'Next review', '→'),
  );
  return navigation;
}

function navigationButton(
  direction: NavigationDirection,
  label: string,
  glyph: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'critic-card-control critic-card-navigation-button';
  button.dataset['criticNavigation'] = String(direction);
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = glyph;
  return button;
}

function navigationDirection(
  value: string | undefined,
): NavigationDirection | null {
  if (value === '-1') return -1;
  if (value === '1') return 1;
  return null;
}

function actionButton(action: ReviewAction): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `critic-card-control critic-card-action critic-card-action-${action}`;
  button.dataset['criticAction'] = action;
  const label = actionLabel(action);
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = action === 'reject' ? '×' : '✓';
  return button;
}

function actionLabel(action: ReviewAction) {
  switch (action) {
    case 'accept':
      return 'Accept suggestion';
    case 'reject':
      return 'Reject suggestion';
    case 'resolve':
      return 'Resolve comment';
  }
}
