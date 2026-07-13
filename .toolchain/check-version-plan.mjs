import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const versionsDirectory = path.join(root, '.yarn', 'versions');
const packageConfig = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
);
const packageName = packageConfig.name;
const allowedStrategies = new Set(['patch', 'minor', 'major']);
const releases = [];
const declined = new Set();

function parseKey(value) {
  const key = value.trim();

  if (key.startsWith('"')) return JSON.parse(key);
  if (key.startsWith("'") && key.endsWith("'")) {
    return key.slice(1, -1).replaceAll("''", "'");
  }

  return key;
}

if (typeof packageName !== 'string' || packageName.length === 0) {
  throw new TypeError('package.json must contain a package name.');
}

const allVersionFiles = fs.existsSync(versionsDirectory)
  ? fs
      .readdirSync(versionsDirectory)
      .filter(file => file.endsWith('.yml'))
      .sort()
  : [];
// biome-ignore lint/style/noProcessEnv: GitHub exposes the PR base this way.
const baseBranch = process.env.GITHUB_BASE_REF;
const versionFiles = baseBranch
  ? execFileSync(
      'git',
      [
        'diff',
        '--name-only',
        '--diff-filter=AM',
        `origin/${baseBranch}...HEAD`,
        '--',
        '.yarn/versions',
      ],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(file => path.basename(file))
      .filter(file => allVersionFiles.includes(file))
  : allVersionFiles;

if (baseBranch && versionFiles.length === 0) {
  throw new Error('This pull request must add a deferred version file.');
}

for (const versionFile of versionFiles) {
  const contents = fs.readFileSync(
    path.join(versionsDirectory, versionFile),
    'utf8',
  );
  let section;

  for (const line of contents.split('\n')) {
    const sectionMatch = /^([a-z]+):\s*$/u.exec(line);
    if (sectionMatch) {
      [section] = sectionMatch.slice(1);
      continue;
    }

    if (section === 'releases') {
      const releaseMatch = /^\s{2}(.+):\s+(\S+)\s*$/u.exec(line);
      if (releaseMatch && parseKey(releaseMatch[1]) === packageName) {
        releases.push({ file: versionFile, strategy: releaseMatch[2] });
      }
    } else if (section === 'declined') {
      const declineMatch = /^\s{2}-\s+(.+)\s*$/u.exec(line);
      if (declineMatch) declined.add(parseKey(declineMatch[1]));
    }
  }
}

if (declined.has(packageName)) {
  throw new Error(
    `${packageName} cannot decline a release; choose patch, minor, or major.`,
  );
}

if (releases.length === 0) {
  throw new Error(
    `${packageName} needs a deferred patch, minor, or major release.`,
  );
}

for (const release of releases) {
  if (!allowedStrategies.has(release.strategy)) {
    throw new Error(
      `${release.file} uses unsupported release strategy ${release.strategy}.`,
    );
  }
}

console.log(
  `${packageName} has ${releases.map(release => release.strategy).join(' + ')} release intent.`,
);
