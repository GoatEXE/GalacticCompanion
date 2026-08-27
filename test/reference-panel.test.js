import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createEntryId } from "../src/domain/content.js";

const root = path.resolve(process.cwd());

async function withReferencePanel(run) {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
  try {
    const reference = await server.ssrLoadModule("/src/reference/ReferencePanel.jsx");
    return await run(reference);
  } finally {
    await server.close();
  }
}

test("Rules renders every reference card without the removed chip index", async () => {
  await withReferencePanel(async ({ ReferenceCardList }) => {
    const cards = ["personnel", "vehicle"].flatMap((ruleset) => {
      const entries = JSON.parse(readFileSync(path.join(root, `${ruleset}_manifest.json`), "utf8"));
      return entries.map((entry, index) => ({ entry, entryId: createEntryId(ruleset, entry, index), sections: [] }));
    });
    const html = renderToStaticMarkup(React.createElement(ReferenceCardList, { cards }));

    assert.doesNotMatch(html, /reference-index/);
    assert.doesNotMatch(html, /href="#quick-ref-/);
    assert.equal((html.match(/class="reference-card-header"/g) ?? []).length, 17);
    cards.forEach(({ entry, entryId }) => {
      assert.match(html, new RegExp(`id="${entryId}"`));
      assert.match(html, new RegExp(`>\\s*${entry.title}\\s*<`));
    });
  });
});
