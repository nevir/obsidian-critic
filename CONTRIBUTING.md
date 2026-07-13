# Developing with this template

This guide covers local setup, repository structure, and the rules that keep
the template consistent.

## Set up a plugin

1. Set the plugin ID, name, description, author, and compatibility in
   `manifest.json`. The plugin ID must match its folder name.
2. Set the package name in `package.json`. Keep its version equal to the
   manifest version, and map that version to `minAppVersion` in `versions.json`.
3. Put the repository in a dedicated test vault at
   `.obsidian/plugins/<plugin-id>`.
4. Install [mise](https://mise.jdx.dev/), then run:

   ```sh
   mise install
   mise run install
   mise run dev
   ```

5. Reload Obsidian and enable the plugin under
   **Settings → Community plugins**.

Add plugin behavior in `src/Plugin.ts`. The existing `Settings.ts` and
`SettingsTab.ts` show how to type, load, update, and save plugin settings.

## Use mise tasks

Treat mise as the main interface to the repository:

- `mise run dev` watches the source and rebuilds `main.js`.
- `mise run check` runs lint, typecheck, and build.
- `mise run lint` checks formatting, lint rules, workflows, and config coverage.
- `mise run typecheck` checks TypeScript without emitting files.
- `mise run versioncheck` checks deferred version intent and manifest versions.
- `mise run build` creates and smoke-tests the production bundle.
- `mise run fix` applies safe Biome fixes.

The `build`, `dev`, `fix`, and `test` Yarn scripts are thin aliases for editor
and package-manager integrations; `test` runs `mise run check`. CI shows lint,
typecheck, build, and pull-request version checks separately.

## Know the repository structure

- `src/` contains plugin code shared by desktop and mobile.
- `manifest.json` and `versions.json` describe Obsidian compatibility.
- `biome.jsonc` and `tsconfig.json` are small entry points into `.toolchain/`.
- `.toolchain/biome/` contains formatting and lint policy.
- `.toolchain/typescript/` contains compiler policy.
- `.toolchain/check-explicit-config.mjs` detects new Biome rules and TypeScript
  type-checking options.
- `.toolchain/check-bundle.mjs` checks the production bundle's exports, source
  maps, and mobile initialization.
- `.toolchain/sync-version.mjs` keeps package and Obsidian versions aligned.
- `.mise.toml` defines tasks and tools; `mise.lock` pins their versions.
- `main.js` is generated output. Change the TypeScript source instead.

## Keep configuration explicit

Keep `biome.jsonc` and `tsconfig.json` as small entry points into `.toolchain/`;
put their reusable policy there rather than growing the root files.

Every Biome rule belongs in
`.toolchain/biome/rules/<language>/<category>.jsonc`. Give it an explicit
severity and a comment explaining the decision. Rules shared by several
languages live under `rules/shared/`.

Every TypeScript option in the compiler's **Type Checking** section must be
explicit in `.toolchain/typescript/base.jsonc`, with a short reason. Run
`mise run check` after upgrading Biome or TypeScript; the coverage check lists
new decisions that need to be made.

## Preserve mobile support

`isDesktopOnly` is `false`. Code and runtime dependencies must therefore load
without Node.js or Electron. Prefer Obsidian's `Vault`, `Platform`, and
`requestUrl` APIs.

Desktop-only enhancements are allowed when they are guarded by
`Platform.isDesktopApp` and their modules are resolved only at runtime. Parcel
can hoist a direct import or literal `require('node:fs')`, even from inside that
guard. The bundle check rejects those startup-time loads.

The bundle check simulates module initialization on iOS and Android; it does not
replace testing real plugin behavior on both platforms.

## Change dependencies carefully

Use the Yarn version installed by mise and commit the resulting `yarn.lock`.
Third-party install scripts are disabled unless a package is explicitly allowed
under `dependenciesMeta` in `package.json`.

`.yarnrc.yml` contains exact-version repairs for two Parcel dependency metadata
issues. Keep them narrow so unrelated peer warnings remain visible. Revisit or
remove them when Parcel is upgraded.

## Release a plugin

Every pull request must declare the release it should produce:

```sh
yarn version patch --deferred
```

Use `minor` or `major` instead of `patch` when appropriate. Commit the generated
file under `.yarn/versions/`. `preferDeferredVersions` is also enabled as a
safety net, and the Version CI check runs `yarn version check` with full Git
history. The project check rejects `decline` and any strategy other than
`patch`, `minor`, or `major`.

After the pull request merges, `.github/workflows/release.yml`:

1. Applies all deferred versions with `yarn version apply --all`.
2. Updates `manifest.json` and `versions.json` from `package.json`.
3. Runs the full validation suite.
4. Commits the applied version to `main`.
5. Creates the matching tag and dispatches the publication workflow from that
   exact tag.

`.github/workflows/publish-release.yml` rebuilds from the tagged commit, attests
the bundle, and publishes a GitHub release containing `main.js`,
`manifest.json`, and `styles.css` when present.

The workflow uses the repository's `GITHUB_TOKEN`. Give GitHub Actions read and
write repository permission so it can push the version commit and tag.
If `main` is protected, its ruleset must also allow this workflow to push the
generated release commit. Pushes made with `GITHUB_TOKEN` do not trigger another
push workflow. Publication is dispatched explicitly at the tag, so the release
workflow cannot loop and provenance points to the released commit.
