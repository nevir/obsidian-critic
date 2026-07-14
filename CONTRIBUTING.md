# Contributing to Critic

Critic is deliberately split into a portable review engine and a thin Obsidian
adapter. Preserve that boundary: review semantics should remain easy to test,
reason about, and eventually port to another host.

## Set up the repository

Install [mise](https://mise.jdx.dev/), then run:

```sh
mise install
mise run install
mise run test
```

For interactive development, place or symlink the repository at
`.obsidian/plugins/critic` in a dedicated test vault, run `mise run dev`, then
reload Obsidian and enable **Critic** under **Settings → Community plugins**.
The watch task rebuilds `main.js` as source files change.

## Understand the architecture

- `src/core/syntax/` parses CriticMarkup into source ranges and review groups.
- `src/core/layout/` solves review-card positions and coupled scrolling from
  plain measurements. It must not depend on the DOM, browser events, Obsidian,
  or CodeMirror.
- `src/core/mutations.ts` creates atomic accept, reject, and resolve edits.
- `src/core/projection.ts` produces original and proposed Reading View source.
- `src/obsidian/editor/` owns the CodeMirror extension and Live Preview
  decorations.
- `src/obsidian/review/` measures the host, renders cards, and adapts input to
  the portable layout engine.
- `src/obsidian/reading/` applies whole-document projection through Obsidian's
  Markdown postprocessor lifecycle.
- `tests/core/` specifies portable behavior; `tests/obsidian/` covers adapter
  logic that can be exercised without launching the app.

Keep source edits as plain, range-based data until the Obsidian boundary. Keep
DOM reads and writes in CodeMirror `requestMeasure` phases. Use supported
Obsidian APIs; do not reach into private editor internals to recover rendered
widget structure.

## Make a change

For a bug, first add the smallest regression test that demonstrates the broken
contract. Favor observable behavior over implementation details. Layout work
should include edge, collision, oversized-card, focus, and continuity cases as
appropriate; one-pixel and randomized property tests protect the solver from
discontinuous motion.

Keep modules focused and names literal. Extract an abstraction when it removes
a real duplicate concept or clarifies ownership, not in anticipation of future
features. Comments should explain intent, host constraints, or invariants that
the code cannot make obvious.

Run the focused test while iterating, then the complete gate before committing:

```sh
mise run test
mise run check
```

The useful tasks are:

- `mise run dev` watches and rebuilds the development bundle.
- `mise run test` type-checks and runs host-independent tests.
- `mise run lint` checks formatting, lint rules, workflows, and explicit config.
- `mise run typecheck` checks the plugin without emitting files.
- `mise run build` creates and smoke-tests the production bundle on simulated
  iOS and Android runtimes.
- `mise run check` runs every required validation except release-version intent.
- `mise run fix` applies safe Biome formatting and lint fixes.

`main.js` is generated output. Change TypeScript source, then rebuild it. Bundle
initialization tests do not replace interactive checks in Obsidian; changes to
decorations, focus, scrolling, Reading View, or mobile presentation should be
exercised in the real app before release.

## Preserve the toolchain contract

The root Biome and TypeScript configs delegate to explicit policy under
`.toolchain/`. Every Biome rule and every TypeScript type-checking option has a
documented decision. After upgrading either tool, run `mise run check` and
resolve newly reported policy choices rather than enabling a broad preset.

Critic supports desktop and mobile. Runtime code must load without Node.js or
Electron; prefer Obsidian's cross-platform APIs. The production bundle check
rejects source maps and startup-time platform dependencies.

Use the Yarn version installed by mise and commit `yarn.lock` when dependencies
change. Install scripts remain disabled unless a package is explicitly allowed
under `dependenciesMeta`.

## Prepare a release change

Every pull request declares the release it should produce:

```sh
yarn version patch --deferred
```

Use `minor` or `major` when appropriate and commit the generated file under
`.yarn/versions/`. CI validates the deferred version, manifests, lint, tests,
typecheck, and production bundle. Merging applies the version, tags the exact
commit, and publishes `main.js`, `manifest.json`, and `styles.css`.
