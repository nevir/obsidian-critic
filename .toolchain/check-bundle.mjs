import fs from 'node:fs';
import path from 'node:path';
import { createContext, Script } from 'node:vm';

const bundleFile = path.resolve(import.meta.dirname, '..', 'main.js');
const bundle = fs.readFileSync(bundleFile, 'utf8');
const packageFile = path.resolve(import.meta.dirname, '..', 'package.json');
const packageConfig = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const nodeModulePolicy = packageConfig.targets.default.includeNodeModules;
const mobileHostModules = new Set(
  Object.entries(nodeModulePolicy)
    .filter(
      ([specifier, bundled]) => bundled === false && specifier !== 'electron',
    )
    .map(([specifier]) => specifier),
);

function externalStub() {
  return externalModule;
}

const externalModule = new Proxy(externalStub, {
  get(target, property, receiver) {
    if (property in target) return Reflect.get(target, property, receiver);
    return receiver;
  },
});

const mobilePlatforms = new Map([
  [
    'iOS',
    {
      isAndroidApp: false,
      isDesktop: false,
      isDesktopApp: false,
      isIosApp: true,
      isLinux: false,
      isMacOS: true,
      isMobile: true,
      isMobileApp: true,
      isPhone: true,
      isSafari: true,
      isTablet: false,
      isWin: false,
      resourcePathPrefix: 'file:///',
    },
  ],
  [
    'Android',
    {
      isAndroidApp: true,
      isDesktop: false,
      isDesktopApp: false,
      isIosApp: false,
      isLinux: false,
      isMacOS: false,
      isMobile: true,
      isMobileApp: true,
      isPhone: true,
      isSafari: false,
      isTablet: false,
      isWin: false,
      resourcePathPrefix: 'file:///',
    },
  ],
]);

function loadBundleOnMobile(platformName, platform) {
  const obsidianModule = new Proxy(
    {},
    {
      get(_target, property) {
        return property === 'Platform' ? platform : externalModule;
      },
    },
  );
  const pluginModule = { exports: {} };
  const context = createContext({
    console,
    exports: pluginModule.exports,
    module: pluginModule,
    require(specifier) {
      if (specifier === 'obsidian') return obsidianModule;

      const isMobileHostModule = [...mobileHostModules].some(
        host => specifier === host || specifier.startsWith(`${host}/`),
      );
      if (isMobileHostModule) return externalModule;

      throw new Error(
        `main.js loads ${specifier} while initializing on ${platformName}.`,
      );
    },
  });

  new Script(bundle, { filename: bundleFile }).runInContext(context);

  if (typeof pluginModule.exports.default !== 'function') {
    throw new TypeError(
      `main.js does not export an Obsidian plugin on ${platformName}.`,
    );
  }
}

for (const [platformName, platform] of mobilePlatforms) {
  loadBundleOnMobile(platformName, platform);
}

// biome-ignore lint/security/noSecrets: This source-map marker is not a secret.
if (bundle.includes('sourceMappingURL')) {
  throw new Error('The production main.js unexpectedly includes a source map.');
}

console.log('main.js loads on iOS and Android and has no source map.');
