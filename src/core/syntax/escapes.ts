const CRITIC_TOKENS = [
  '{++',
  '{--',
  '{~~',
  '{>>',
  '{==',
  '++}',
  '--}',
  '~~}',
  '<<}',
  '==}',
  '~>',
] as const;

export function isEscaped(source: string, offset: number): boolean {
  let backslashes = 0;
  for (
    let index = offset - 1;
    index >= 0 && source[index] === '\\';
    index -= 1
  ) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

export function decodeCriticEscapes(value: string): string {
  let decoded = '';

  for (let index = 0; index < value.length; ) {
    if (value[index] !== '\\') {
      decoded += value[index];
      index += 1;
      continue;
    }

    const runStart = index;
    while (value[index] === '\\') index += 1;
    const runLength = index - runStart;
    const token = CRITIC_TOKENS.find(candidate =>
      value.startsWith(candidate, index),
    );
    decoded += '\\'.repeat(
      token !== undefined && runLength % 2 === 1 ? runLength - 1 : runLength,
    );
  }

  return decoded;
}
