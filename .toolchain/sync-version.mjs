import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const packageFile = path.join(root, 'package.json');
const manifestFile = path.join(root, 'manifest.json');
const versionsFile = path.join(root, 'versions.json');
const mode = process.argv[2] ?? '--check';

if (mode !== '--check' && mode !== '--write') {
  throw new Error('Usage: sync-version.mjs --check|--write');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const packageConfig = readJson(packageFile);
const manifest = readJson(manifestFile);
const versions = readJson(versionsFile);
const version = packageConfig.version;
const minimumAppVersion = manifest.minAppVersion;

if (typeof version !== 'string' || version.length === 0) {
  throw new TypeError('package.json must contain a version.');
}

if (typeof minimumAppVersion !== 'string' || minimumAppVersion.length === 0) {
  throw new TypeError('manifest.json must contain a minAppVersion.');
}

if (mode === '--write') {
  if (
    versions[version] !== undefined &&
    versions[version] !== minimumAppVersion
  ) {
    throw new Error(
      `versions.json already maps ${version} to ${versions[version]}.`,
    );
  }

  manifest.version = version;
  versions[version] = minimumAppVersion;
  writeJson(manifestFile, manifest);
  writeJson(versionsFile, versions);
  console.log(`Synchronized Obsidian metadata for ${version}.`);
} else {
  if (manifest.version !== version) {
    throw new Error(
      `package.json is ${version}, but manifest.json is ${manifest.version}.`,
    );
  }

  if (versions[version] !== minimumAppVersion) {
    throw new Error(
      `versions.json must map ${version} to ${minimumAppVersion}.`,
    );
  }

  console.log(`Package and Obsidian metadata agree on ${version}.`);
}
