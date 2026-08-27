import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createCharacter, createRoster } from "../src/companion/schema.js";

async function withShell(run) {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
  try {
    const app = await server.ssrLoadModule("/src/app/App.jsx");
    const shell = await server.ssrLoadModule("/src/shell/DossierShell.jsx");
    const views = await server.ssrLoadModule("/src/shell/CompanionViews.jsx");
    return await run({ ...app, ...shell, ...views });
  } finally {
    await server.close();
  }
}

test("primary navigation distinguishes application routes from Rules anchors and exposes persistent file controls", async () => {
  await withShell(async ({ DossierShell, routeFromHash, viewFromHash }) => {
    assert.equal(viewFromHash("#create"), "create");
    assert.equal(viewFromHash("#/sheet"), "sheet");
    assert.equal(viewFromHash("#rules"), "rules");
    assert.equal(viewFromHash("#legacy-reference"), "dossier");
    assert.deepEqual(routeFromHash("#rules-reference"), { view: "rules", scrollTarget: "rules-reference" });
    assert.deepEqual(routeFromHash("#dice-roller"), { view: "rules", scrollTarget: "dice-roller" });
    assert.deepEqual(routeFromHash("#quick-ref-personnel-0-markdown-personnel-character-development-md-character-development"), {
      view: "rules", scrollTarget: "quick-ref-personnel-0-markdown-personnel-character-development-md-character-development"
    });

    const html = renderToStaticMarkup(React.createElement(DossierShell, {
      view: "dossier", onNavigate: () => {}, onImport: () => {}, onExport: () => {}, canExport: false
    }, React.createElement("main", { id: "main-content" })));
    ["Dossier", "Create", "Sheet", "Rules", "Export", "Import"].forEach((label) => assert.match(html, new RegExp(`>${label}<`, "i")));
    assert.match(html, /aria-current="page"/);
    assert.match(html, /disabled=""/);
  });
});

test("a fresh direct Create route synchronously opens a draft and never renders the creator with null", async () => {
  await withShell(async ({ default: App, CreateView, initializeAppState }) => {
    const saved = new Map();
    const storage = {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value)
    };
    const initial = initializeAppState("#create", storage);
    assert.equal(initial.route.view, "create");
    assert.ok(initial.roster.activeCharacterId);
    assert.equal(initial.roster.characters.length, 1);
    assert.equal(JSON.parse(saved.get("aor-companion-roster")).characters.length, 1);

    const originalWindow = globalThis.window;
    globalThis.window = { location: { hash: "#create" }, localStorage: storage };
    try {
      const app = renderToStaticMarkup(React.createElement(App));
      assert.match(app, /Character budgets/);
      assert.doesNotMatch(app, /Opening Personnel File/);
    } finally {
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
    }

    const pending = renderToStaticMarkup(React.createElement(CreateView, { active: null, onChange: () => {}, onOpenSheet: () => {} }));
    assert.match(pending, /Opening Personnel File/);
    assert.doesNotMatch(pending, /Character budgets/);
  });
});

test("dossier and sheet empty states lead with creating a local personnel file and retain legacy PDF sheets", async () => {
  await withShell(async ({ DossierHome, SheetView }) => {
    const common = { onCreate: () => {}, onEdit: () => {}, onDelete: () => {}, onOpenSheet: () => {}, onOpenRules: () => {}, onOpenDice: () => {}, onSelectCharacter: () => {} };
    const home = renderToStaticMarkup(React.createElement(DossierHome, { roster: createRoster(), active: null, ...common }));
    assert.match(home, /Personnel File/);
    assert.match(home, /No Character on File/);
    assert.match(home, /Create Character/);
    assert.match(home, /Quick Reference/);
    assert.match(home, /Dice Pool/);
    assert.match(home, /Legacy PDF character sheets/);
    assert.equal((home.match(/Resources\/Character Sheets\/[^\"]+\.pdf/g) ?? []).length, 7);

    const active = {
      ...createCharacter(), name: "Kessa Venn", backgroundId: "alliance-recruit", dutyId: "intelligence", speciesId: "bothan",
      careerId: "soldier", specializationId: "commando", careerTraining: ["athletics", "brawl", "knowledge-warfare", "medicine"],
      specializationTraining: ["brawl", "melee"]
    };
    const activeHome = renderToStaticMarkup(React.createElement(DossierHome, { roster: { ...createRoster(), activeCharacterId: active.id, characters: [active] }, active, ...common }));
    assert.match(activeHome, /Bothan · Soldier · Commando/);
    assert.match(activeHome, /Open Playable Sheet/);
    assert.match(activeHome, /Delete Local File/);

    const sheet = renderToStaticMarkup(React.createElement(SheetView, { active: null, onCreate: () => {}, onEdit: () => {}, onChange: () => {} }));
    assert.match(sheet, /Playable Sheet/);
    assert.match(sheet, /No Active Character/);
    assert.match(sheet, /Create Character/);
  });
});
