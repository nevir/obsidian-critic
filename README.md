# Obsidian Plugin Template

An opinionated TypeScript starter for Obsidian plugins that run on desktop,
iOS, and Android. It uses the ES2021 baseline from Obsidian's official sample
and requires Obsidian 1.12.7 or newer.

## What this template gives you

- **A repeatable toolchain.** [mise](https://mise.jdx.dev/) installs the locked
  Node, Yarn, and actionlint versions on macOS, Linux, and Windows.
- **Clear, upgrade-aware rules.** Every Biome rule and every TypeScript
  type-checking option has an explicit choice and a short reason. Biome and
  TypeScript upgrades fail until new options have been reviewed.
- **Mobile support by default.** Source code cannot import Node.js built-ins,
  and the production bundle must initialize in simulated iOS and Android
  environments.
- **Useful pull-request checks.** Lint, typecheck, and build appear as separate
  GitHub checks while sharing one workflow and cache setup.
- **Safer dependency installs.** CI uses an immutable Yarn lockfile. Dependency
  scripts are disabled by default, and newly published packages have a one-day
  age gate.
- **A small typed starting point.** The sample code includes saved settings and
  a settings tab without carrying a large feature demo into a new plugin.
- **Reviewable, automatic releases.** Each pull request declares its semantic
  version change. Merging applies that change, tags the result, attests the
  bundle, and publishes a GitHub release.

## Compared with the official template

The [official Obsidian sample
plugin](https://github.com/obsidianmd/obsidian-sample-plugin) is the best small
example of the plugin API. It uses npm, esbuild, TypeScript, Obsidian-specific
ESLint rules, and a tag-driven draft release workflow.

This template adds tighter tool version control, stricter explicit
configuration, hardened installs, independent CI results, a mobile startup
check, and merge-driven releases using Yarn's deferred versioning. The tradeoff
is more tooling and more work when those tools add rules or options.

The official sample remains a better fit if you want the simplest supported
setup, its richer API examples, Obsidian-specific ESLint rules, or its automated
draft-release flow. Obsidian-specific ESLint rules are not currently included
here.

## Use the template

Create a repository from this template, replace its plugin metadata, and follow
[CONTRIBUTING.md](CONTRIBUTING.md) to set up the toolchain and start developing.

The root Biome and TypeScript configs are intentionally small. Their reusable
policy lives under `.toolchain/` so it can eventually move into a shared
package.
