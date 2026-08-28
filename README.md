# Galactic Companion

Galactic Companion is a personal quick reference and dice roller for *Star Wars: Age of Rebellion*.

- I intend to use this web app for personal use only.
- I am not affiliated with the linked content in any way.
- This page dynamically uses Markdown files and translates them into JSON to populate cards in the Rules Reference section.

# Adding Cards to the References Documentation
- See [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) for the content format, citation guidance, and Markdown-vs-YAML recommendation.
- Create a markdown file in the `Markdown/<Ruleset>/` subdirectory.
- Add the card title, Font Awesome icon classes, and repo-relative file path to the matching root manifest, such as `personnel_manifest.json` or `vehicle_manifest.json`.
- Before publishing content changes, run `node tools/validate-content.js`.

# Quick Format Note
- Keep prose in Markdown and structure/metadata in JSON manifests. Avoid YAML for now because this static browser app would need a YAML parser dependency or custom parsing without a clear benefit for the current content.

# React companion foundation

The static site is now a Vite + React SPA. It keeps the root manifests and Markdown files as the source of truth; Vite copies those files and the existing `Resources/` directory into the production output without rewriting their content.

## Local development

```bash
npm install
npm run dev
```

Vite is configured for the planned GitHub Pages path at `/GalacticCompanion/`. The development server also serves the existing root content through that base path, and the Pages workflow uploads the built `dist` directory.

## Validation

```bash
npm run check
npm test
npm run build
node tools/validate-content.js
```

The foundation is organized into `src/shell/` (dossier shell and character-sheet dialog), `src/reference/` (manifest/Markdown cards), `src/dice/` (roller UI), and `src/domain/` (content, dice, and background behavior). The dice-domain tests cover Triumph/Despair contributions and cancellation behavior.

## Local character companion

**Characters** opens a browser-local personnel-file companion. It supports multiple draft or playable characters, a seven-step starter creator, budget checks, JSON import/export, and a sheet with skill/weapon rolls, play-state trackers, and source-cautious talent review.

- The versioned roster is stored under `aor-companion-roster` in browser localStorage. Use **Export active** before clearing site data or changing browsers.
- The normalized starter catalogue and its source notes are in `src/companion/catalog.js`; validation, migrations, calculations, and persistence are split into the other `src/companion/` modules.
- It intentionally covers a compact starter roster (eight core species and four core careers) rather than claiming a complete rules compendium. Talent connector diagrams and talent effects are explicitly not modeled; verify them in the Core Rulebook with the GM.
- Starter species, career, and gear entries are concise data aids, not replacement rule text. The in-app source note identifies the relevant Core Rulebook chapters.

`npm test` includes catalogue/schema/migration/budget/persistence/import tests plus Vite SSR component smoke coverage for the creator and playable sheet.

# Credits
- Font Awesome used for icons.
- Favicon from svgrepo.com .
- Background images came from a collection of desktop wallpapers I've kept throughout the years. I'd honor the artists if I knew where they came from.
- Linked sources and core rules are owned by their respective domain owners.
- Made with love from Arkansas.