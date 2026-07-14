export function readSourceMode(editorInfo: unknown): unknown {
  if (
    typeof editorInfo !== 'object' ||
    editorInfo === null ||
    !('getState' in editorInfo) ||
    typeof editorInfo.getState !== 'function'
  ) {
    return;
  }
  const viewState: unknown = editorInfo.getState();
  return typeof viewState === 'object' && viewState !== null
    ? Reflect.get(viewState, 'source')
    : undefined;
}

export function resolveLivePreviewMode(
  sourceMode: unknown,
  editorFieldMode: boolean | undefined,
): boolean | undefined {
  return typeof sourceMode === 'boolean' ? !sourceMode : editorFieldMode;
}
