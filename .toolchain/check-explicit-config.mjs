import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const biomeSchema = require('@biomejs/biome/configuration_schema.json');
const ts = require('typescript');

const root = path.resolve(import.meta.dirname, '..');
const failures = [];

function readJsonc(file) {
  const text = fs.readFileSync(file, 'utf8');
  const { config, error } = ts.parseConfigFileTextToJson(file, text);

  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  }

  return { config, text };
}

function collectBiomeConfig(
  file,
  files = new Map(),
  rules = new Map(),
  rootFile = path.resolve(file),
) {
  const absoluteFile = path.resolve(file);
  if (files.has(absoluteFile)) return { files, rules };

  const { config, text } = readJsonc(absoluteFile);
  files.set(absoluteFile, text);

  if (absoluteFile !== rootFile && (config.extends?.length ?? 0) > 0) {
    failures.push(
      `Biome extended config cannot itself extend other files: ${path.relative(
        root,
        absoluteFile,
      )}`,
    );
  }

  for (const extendedFile of config.extends ?? []) {
    collectBiomeConfig(
      path.resolve(path.dirname(absoluteFile), extendedFile),
      files,
      rules,
      rootFile,
    );
  }

  for (const [group, groupRules] of Object.entries(
    config.linter?.rules ?? {},
  )) {
    if (group === 'preset' || group === 'recommended') continue;
    if (typeof groupRules !== 'object' || groupRules === null) continue;

    for (const rule of Object.keys(groupRules)) {
      if (rule === 'preset' || rule === 'recommended') continue;

      const qualifiedRule = `${group}/${rule}`;
      const previousRule = rules.get(qualifiedRule);
      if (previousRule) {
        failures.push(
          `Biome rule is declared more than once: ${qualifiedRule} ` +
            `(${path.relative(root, previousRule.file)} and ` +
            `${path.relative(root, absoluteFile)})`,
        );
      } else {
        rules.set(qualifiedRule, {
          file: absoluteFile,
          value: groupRules[rule],
        });
      }
    }
  }

  return { files, rules };
}

function schemaRuleNames() {
  const definitions = biomeSchema.$defs ?? biomeSchema.definitions;
  const groups = Object.keys(definitions.Rules.properties).filter(
    group => group !== 'preset' && group !== 'recommended',
  );

  return groups.flatMap(group => {
    const definitionName = group[0].toUpperCase() + group.slice(1);
    return Object.keys(definitions[definitionName].properties)
      .filter(rule => rule !== 'preset' && rule !== 'recommended')
      .map(rule => `${group}/${rule}`);
  });
}

function adjacentRationale(text, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const commentAndProperty = new RegExp(
    `(?:^|\\n)(?:\\s*//[^\\n]*\\n)+\\s*"${escapedProperty}"\\s*:`,
    'mu',
  );
  const matchStart = text.search(commentAndProperty);
  if (matchStart < 0) return;

  const propertyStart = text.indexOf(`"${property}"`, matchStart);
  const comments = text.slice(matchStart, propertyStart);

  return comments
    .split('\n')
    .map(line => line.replace(/^\s*\/\/\s?/u, '').trim())
    .filter(Boolean)
    .join(' ');
}

function hasSubstantiveRationale(text, property) {
  const rationale = adjacentRationale(text, property);
  if (!rationale) return false;

  const words = rationale.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  return words.length >= 4;
}

function checkBiomeConfig() {
  const { files, rules } = collectBiomeConfig(path.join(root, 'biome.jsonc'));
  const expectedRules = new Set(schemaRuleNames());
  if (expectedRules.size === 0) {
    throw new Error('Biome schema did not expose any lint rules.');
  }

  for (const rule of expectedRules) {
    if (!rules.has(rule)) failures.push(`Biome rule is not explicit: ${rule}`);
  }

  for (const [rule, { file, value }] of rules) {
    if (!expectedRules.has(rule)) failures.push(`Unknown Biome rule: ${rule}`);

    const hasExplicitLevel =
      typeof value === 'string' ||
      (typeof value === 'object' &&
        value !== null &&
        typeof value.level === 'string');
    if (!hasExplicitLevel) {
      failures.push(`Biome rule lacks an explicit level: ${rule}`);
    }

    const property = rule.slice(rule.indexOf('/') + 1);
    if (!hasSubstantiveRationale(files.get(file), property)) {
      failures.push(
        `Biome rule lacks a substantive adjacent rationale: ${rule}`,
      );
    }

    const group = rule.slice(0, rule.indexOf('/'));
    const relativeRuleFile = path.relative(
      path.join(root, '.toolchain', 'biome', 'rules'),
      file,
    );
    const [language, filename, ...extraSegments] = relativeRuleFile.split(
      path.sep,
    );
    const languages = new Set([
      'css',
      'graphql',
      'html',
      'javascript',
      'json',
      'shared',
    ]);
    if (
      !languages.has(language) ||
      filename !== `${group}.jsonc` ||
      extraSegments.length > 0
    ) {
      failures.push(
        `Biome rule is not in rules/<language>/<category>.jsonc: ${rule} ` +
          `(${relativeRuleFile})`,
      );
    }
  }

  const rulesDirectory = path.join(root, '.toolchain', 'biome', 'rules');
  const configuredRuleFiles = new Set(
    [...rules.values()].map(rule => rule.file),
  );
  const pendingDirectories = [rulesDirectory];
  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (
        entry.name.endsWith('.jsonc') &&
        !configuredRuleFiles.has(entryPath)
      ) {
        failures.push(
          `Biome rule file is empty or not extended: ${path.relative(
            root,
            entryPath,
          )}`,
        );
      }
    }
  }
}

function checkTypeScriptConfig() {
  const files = new Map();
  const configuredOptions = new Map();

  function collectConfig(file) {
    const absoluteFile = path.resolve(file);
    if (files.has(absoluteFile)) return;

    const { config, text } = readJsonc(absoluteFile);
    files.set(absoluteFile, text);

    let extendedConfigs = [];
    if (Array.isArray(config.extends)) {
      extendedConfigs = config.extends;
    } else if (config.extends) {
      extendedConfigs = [config.extends];
    }
    for (const extendedConfig of extendedConfigs) {
      const resolvedConfig = path.resolve(
        path.dirname(absoluteFile),
        extendedConfig,
      );
      collectConfig(resolvedConfig);
    }

    for (const [option, value] of Object.entries(
      config.compilerOptions ?? {},
    )) {
      const previousOption = configuredOptions.get(option);
      if (previousOption) {
        failures.push(
          `TypeScript option is declared more than once: ${option} ` +
            `(${path.relative(root, previousOption.file)} and ` +
            `${path.relative(root, absoluteFile)})`,
        );
      } else {
        configuredOptions.set(option, { file: absoluteFile, value });
      }
    }
  }

  collectConfig(path.join(root, 'tsconfig.json'));

  const typeCheckingOptions = ts.optionDeclarations
    .filter(option => option.category?.message === 'Type Checking')
    .map(option => option.name);
  if (typeCheckingOptions.length === 0) {
    throw new Error('TypeScript did not expose any type-checking options.');
  }

  for (const option of typeCheckingOptions) {
    const configuredOption = configuredOptions.get(option);
    if (!configuredOption) {
      failures.push(`TypeScript option is not explicit: ${option}`);
    } else if (typeof configuredOption.value !== 'boolean') {
      failures.push(`TypeScript option is not boolean: ${option}`);
    } else if (
      !hasSubstantiveRationale(files.get(configuredOption.file), option)
    ) {
      failures.push(
        `TypeScript option lacks a substantive adjacent rationale: ${option}`,
      );
    }
  }
}

checkBiomeConfig();
checkTypeScriptConfig();

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Biome rules and TypeScript type-checking options are explicit.');
}
