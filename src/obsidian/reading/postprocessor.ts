import {
  type App,
  type MarkdownPostProcessor,
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  TFile,
} from 'obsidian';

import type { ReviewProjection } from '../../core/projection';
import { prepareReadingDocument } from './document-projection';

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

const documentRenders = new WeakMap<HTMLElement, DocumentRender>();
let nextRenderToken = 0;

export function createReadingPostProcessor(
  app: App,
  getProjection: () => ReviewProjection,
): MarkdownPostProcessor {
  return async (element, context) => {
    if (element.closest(PROJECTION_SELECTOR) !== null) return;
    const previewSection = element.closest<HTMLElement>(
      '.markdown-preview-section',
    );
    if (previewSection === null) return;

    const file = fileForPreviewSection(app, previewSection, context.sourcePath);
    if (file === null) return;
    const source = await app.vault.cachedRead(file);

    const existing = documentRenders.get(previewSection);
    const projection = getProjection();
    const prepared = prepareReadingDocument(source, projection);
    const ownsDocument =
      (existing?.host.parentElement === previewSection &&
        existing.wrapper.parentElement === existing.host) ||
      previewSection.querySelector(`:scope > ${OWNED_BLOCK_SELECTOR}`) !== null;
    if (prepared === null && !ownsDocument) return;
    const renderDocument = prepared ?? { markdown: source, projected: source };

    if (
      existing?.host.parentElement === previewSection &&
      existing.wrapper.parentElement === existing.host &&
      existing.projection === projection &&
      existing.source === source &&
      existing.sourcePath === file.path
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
    documentRenders.set(previewSection, {
      projection,
      source,
      sourcePath: file.path,
      token,
      host,
      wrapper,
    });

    const child = new MarkdownRenderChild(wrapper);
    context.addChild(child);
    try {
      await MarkdownRenderer.render(
        app,
        renderDocument.markdown,
        wrapper,
        file.path,
        child,
      );
      if (!renderIsCurrent(previewSection, token, wrapper)) return;
      if (prepared !== null) disableProjectedTasks(wrapper);
    } catch {
      if (!renderIsCurrent(previewSection, token, wrapper)) return;
      wrapper.classList.add('critic-reading-error');
      wrapper.textContent = renderDocument.projected;
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

function claimDocumentBlocks(
  blocks: readonly HTMLElement[],
  host: HTMLElement,
  token: string,
): void {
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
  previewSection: HTMLElement,
  token: string,
  wrapper: HTMLElement,
): boolean {
  const current = documentRenders.get(previewSection);
  return (
    current?.token === token &&
    current.wrapper === wrapper &&
    current.host.parentElement === previewSection &&
    wrapper.parentElement === current.host
  );
}
