import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stylesheet = await readFile(new URL("../src/styles/dossier.css", import.meta.url), "utf8");

test("dossier header keeps brand, primary navigation, and file actions in distinct grid regions", () => {
  assert.match(stylesheet, /\.dossier-nav-inner\s*\{[^}]*grid-template-areas:\s*"brand actions"\s*"navigation navigation"/s);
  assert.match(stylesheet, /\.brand\s*\{[^}]*grid-area:\s*brand/s);
  assert.match(stylesheet, /\.primary-nav\s*\{[^}]*grid-area:\s*navigation[^}]*position:\s*static/s);
  assert.match(stylesheet, /\.shell-actions\s*\{[^}]*grid-area:\s*actions/s);
});

test("narrow dossier navigation uses four bounded columns instead of overflowing the page", () => {
  const narrowHeader = stylesheet.match(/@media \(max-width: 700px\) \{([\s\S]*?)@media \(max-width: 440px\)/)?.[1] ?? "";
  assert.match(narrowHeader, /\.primary-nav\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)[^}]*overflow:\s*visible/s);
  assert.match(narrowHeader, /\.primary-nav button\s*\{[^}]*min-height:\s*2\.75rem[^}]*min-width:\s*0/s);
  assert.match(narrowHeader, /\.shell-action\s*\{[^}]*min-height:\s*2\.75rem[^}]*min-width:\s*2\.75rem/s);
});
