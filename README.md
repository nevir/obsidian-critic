# Critic for Obsidian

Critic turns [CriticMarkup](https://github.com/CriticMarkup/CriticMarkup-toolkit)
in Markdown notes into an inline review experience for Obsidian. The review
state stays in the note itself: another editor can read or change the same
plain-text markup without this plugin.

## What works today

- Live Preview hides CriticMarkup delimiters and renders additions, deletions,
  substitutions, highlights, and comments in place.
- A review rail on wide panes, and a focused sheet on narrow panes, presents
  comment threads and accept, reject, or resolve actions.
- Clicking an annotation or card focuses the complete review. Arrow keys move
  between reviews while one is focused.
- Comments support Markdown, adjacent-message threads, and optional `[Name]`
  author prefixes. When any message has an author, unlabeled messages are shown
  as `You`.
- Reading View globally projects either the original or proposed document. The
  choice is persisted across notes and restarts.
- Source mode continues to show and edit the literal CriticMarkup.

Critic uses the standard CriticMarkup forms:

```markdown
{++addition++}
{--deletion--}
{~~before~>after~~}
{==highlight==}{>>[Sam] Comment on the highlight.<<}
{>>A point comment.<<}{>>[Sam] An adjacent reply.<<}
```

Backslash escapes and the `[Name]` comment prefix are Critic extensions. The
source parser, mutations, projections, and review-layout solver live in a
host-independent core so their behavior is testable without Obsidian or a
browser.

## Current boundaries

- This milestone reviews existing markup. Suggestion-mode authoring and
  selection-to-comment workflows are not implemented yet.
- Live Preview relies only on supported Obsidian and CodeMirror APIs. Obsidian
  owns some embedded editor widgets, so exact inline transformation inside
  constructs such as rendered tables, callouts, and images is intentionally
  limited.
- Critic does not add collaboration or synchronization. Obsidian Sync, Git, or
  another file-sync workflow remains responsible for merging Markdown.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture, development
workflow, and validation expectations.
