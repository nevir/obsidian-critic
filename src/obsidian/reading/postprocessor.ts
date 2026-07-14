import {
  type App,
  type MarkdownPostProcessor,
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  TFile,
} from 'obsidian';

import {
  projectCriticMarkup,
  type ReviewProjection,
} from '../../core/projection';

const OWNED_BLOCK_SELECTOR = '[data-critic-reading-owned]';
const PROJECTION_SELECTOR = '[data-critic-reading-projection]';

interface DocumentRender {
  readonly projection: ReviewProjection;
  readonly source: string;
  readonly sourcePath: string;
  readonly token: string;
  readonly host: HTMLElement;
  readonly wrapper: HTMLElement;
}

type DocumentRenders = WeakMap<HTMLElement, DocumentRender>;

export function createReadingPostProcessor(
  app: App,
  getProjection: () => ReviewProjection,
): MarkdownPostProcessor {
  const documentRenders: DocumentRenders = new WeakMap();
  let nextRenderToken = 0;

  return async (element, context) => {
    if (element.closest(PROJECTION_SELECTOR) !== null) return;
    const previewSection = element.closest<HTMLElement>(
      '.markdown-preview-section',
    );
    if (previewSection === null) return;

    const file = fileForPreviewSection(app, previewSection, context.sourcePath);
    if (file === null) return;
    const source = await app.vault.cachedRead(file);

    const projection = getProjection();
    const projected = projectCriticMarkup(source, projection);
    const existing = attachedRender(
      previewSection,
      documentRenders.get(previewSection),
    );
    const ownsDocument =
      existing !== null ||
      previewSection.querySelector(`:scope > ${OWNED_BLOCK_SELECTOR}`) !== null;
    if (projected === source && !ownsDocument) return;

    if (
      existing !== null &&
      renderMatches(existing, projection, source, file.path)
    ) {
      claimLateNativeBlocks(previewSection, context, existing.token);
      return;
    }

    const blocks = sourceBlocks(previewSection, context);
    const host = blocks[0];
    if (host === undefined) return;

    nextRenderToken += 1;
    const token = String(nextRenderToken);
    claimDocumentBlocks(blocks, host, token);
    const wrapper = document.createElement('div');
    wrapper.className = 'critic-reading-section';
    wrapper.dataset['criticReadingProjection'] = token;
    host.append(wrapper);
    const render: DocumentRender = {
      projection,
      source,
      sourcePath: file.path,
      token,
      host,
      wrapper,
    };
    documentRenders.set(previewSection, render);

    const child = new MarkdownRenderChild(wrapper);
    context.addChild(child);
    try {
      await MarkdownRenderer.render(app, projected, wrapper, file.path, child);
      if (!renderIsCurrent(documentRenders, previewSection, render)) return;
      if (projected !== source) disableProjectedTasks(wrapper);
    } catch {
      if (!renderIsCurrent(documentRenders, previewSection, render)) return;
      wrapper.classList.add('critic-reading-error');
      wrapper.textContent = projected;
    }
  };
}

function disableProjectedTasks(wrapper: HTMLElement): void {
  for (const checkbox of wrapper.querySelectorAll<HTMLInputElement>(
    'input.task-list-item-checkbox',
  )) {
    checkbox.disabled = true;
    checkbox.title = 'Switch to Live Preview to update this task';
  }
}

function fileForPreviewSection(
  app: App,
  previewSection: HTMLElement,
  fallbackPath: string,
): TFile | null {
  let file: TFile | null = null;
  app.workspace.iterateAllLeaves(leaf => {
    if (
      file === null &&
      leaf.view instanceof MarkdownView &&
      leaf.view.containerEl.contains(previewSection)
    ) {
      file = leaf.view.file;
    }
  });
  if (file !== null) return file;

  const fallback = app.vault.getAbstractFileByPath(fallbackPath);
  return fallback instanceof TFile ? fallback : null;
}

function claimLateNativeBlocks(
  previewSection: HTMLElement,
  context: MarkdownPostProcessorContext,
  token: string,
): void {
  for (const block of nativeBlocks(previewSection, context)) {
    block.replaceChildren();
    block.dataset['criticReadingOwned'] = token;
    block.classList.add('critic-reading-placeholder');
    block.setAttribute('aria-hidden', 'true');
  }
}

function nativeBlocks(
  previewSection: HTMLElement,
  context: MarkdownPostProcessorContext,
): HTMLElement[] {
  return [...previewSection.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      !child.matches(OWNED_BLOCK_SELECTOR) &&
      context.getSectionInfo(child) !== null,
  );
}

function sourceBlocks(
  previewSection: HTMLElement,
  context: MarkdownPostProcessorContext,
): HTMLElement[] {
  return [...previewSection.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      (child.matches(OWNED_BLOCK_SELECTOR) ||
        context.getSectionInfo(child) !== null),
  );
}

function attachedRender(
  previewSection: HTMLElement,
  render: DocumentRender | undefined,
): DocumentRender | null {
  return render !== undefined && renderIsAttached(previewSection, render)
    ? render
    : null;
}

function renderMatches(
  render: DocumentRender,
  projection: ReviewProjection,
  source: string,
  sourcePath: string,
): boolean {
  return (
    render.projection === projection &&
    render.source === source &&
    render.sourcePath === sourcePath
  );
}

function claimDocumentBlocks(
  blocks: readonly HTMLElement[],
  host: HTMLElement,
  token: string,
): void {
  // Section callbacks expose document-scoped source, so Critic renders one
  // projected document while retaining Obsidian's lifecycle-owned block roots.
  for (const block of blocks) {
    block.replaceChildren();
    block.dataset['criticReadingOwned'] = token;
    block.classList.remove('critic-reading-host');
    block.classList.add('critic-reading-placeholder');
    block.setAttribute('aria-hidden', 'true');
  }
  host.classList.remove('critic-reading-placeholder');
  host.classList.add('critic-reading-host');
  host.removeAttribute('aria-hidden');
}

function renderIsCurrent(
  documentRenders: DocumentRenders,
  previewSection: HTMLElement,
  render: DocumentRender,
): boolean {
  return (
    documentRenders.get(previewSection) === render &&
    renderIsAttached(previewSection, render)
  );
}

function renderIsAttached(
  previewSection: HTMLElement,
  render: DocumentRender,
): boolean {
  return (
    render.host.parentElement === previewSection &&
    render.wrapper.parentElement === render.host
  );
}
