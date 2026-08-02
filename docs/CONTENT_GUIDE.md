# Quick-reference content guide

## Format recommendation

Keep quick-reference bodies in Markdown. The app already fetches plain `.md` files, parses a small predictable subset, and renders safe DOM nodes without a build step. Keep structure and metadata in the root JSON manifests (`*_manifest.json`). Avoid YAML for now: a static browser app would need an added YAML parser dependency or a custom parser, and YAML would not improve the mostly-prose card content enough to justify that cost.

## Current renderer support

`Scripts/main.js` currently reads only:

- top-level section headings that start with `# `
- bullet items that start with `- ` under a section heading
- inline `<b>...</b>` for emphasis inside bullet items
- inline line breaks as `<br>`, `<br/>`, `<br />`, or `</br>` inside bullet items

Other Markdown features, nested lists, tables, links, images, and raw HTML tags are not rendered as formatting by the current quick-reference parser. If a card needs richer presentation, update the parser and validator together rather than relying on unsupported syntax.

## File and manifest conventions

- Store rule cards under `Markdown/<Ruleset>/`, for example `Markdown/Personnel/Recovery.md`.
- Use a concise, title-cased filename that matches the manifest `title` where practical.
- Add each card to the matching root manifest, such as `personnel_manifest.json` or `vehicle_manifest.json`.
- Each manifest entry must include:
  - `title`: display title for the card and quick-reference menu
  - `icon`: Font Awesome class string
  - `file`: repo-relative path to the Markdown file
- Keep manifest filenames in the `<ruleset>_manifest.json` pattern; `<ruleset>` is used by the app when building stable target IDs.

## Metadata and citations

- Use the JSON manifest for card-level metadata if needed, such as `source`, `status`, or `notes`. Extra fields are ignored by the current renderer.
- Use short parenthetical page references in bullet text when a specific rule summary needs attribution, for example `(AoR Core, p. 220)`.
- Do not fail content solely because citation metadata is incomplete during drafting, but prefer adding citations as content is expanded.

## Copyright-safe source use

This reference should summarize and paraphrase rules for table use. Do not copy long passages, tables, flavor text, examples, or proprietary presentation wholesale. Keep entries concise, use your own wording, and cite source pages so the original book remains the authority for full rules text.

## Validate content

Run the dependency-free validator before opening a PR or expanding a batch of cards:

```bash
node tools/validate-content.js
```

The validator checks manifest JSON shape, required manifest fields, referenced Markdown files, generated target ID uniqueness, top-level section headings, and unsupported raw HTML tags.
