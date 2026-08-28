import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { DUTIES } from "../src/companion/catalog.js";
import { createCharacter } from "../src/companion/schema.js";

async function withViews(run) {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const creator = await server.ssrLoadModule("/src/companion/CharacterCreator.jsx");
    const sheet = await server.ssrLoadModule("/src/companion/CharacterSheet.jsx");
    return await run(creator, sheet);
  } finally {
    await server.close();
  }
}

function playableCharacter() {
  return {
    ...createCharacter(), name: "Smoke Operative", backgroundId: "alliance-recruit", dutyId: "intelligence", speciesId: "bothan",
    careerId: "soldier", specializationId: "commando", careerTraining: ["athletics", "brawl", "discipline", "melee"],
    specializationTraining: ["brawl", "melee"], gearIds: ["combat-knife", "blaster-pistol"]
  };
}

test("creator smoke renders the seven accessible steps and starter budget", async () => {
  await withViews(async ({ CharacterCreator }) => {
    const html = renderToStaticMarkup(React.createElement(CharacterCreator, { character: playableCharacter(), onChange: () => {}, onOpenSheet: () => {} }));
    assert.match(html, /Step 1 of 7/);
    ["Background", "Duty", "Species", "Career", "Specialization", "Experience", "Gear"].forEach((step) => assert.match(html, new RegExp(`>${step}<`)));
    assert.match(html, /Character budgets/);
  });
});

test("selected Duty detail panel reveals a clean brief, including Support", async () => {
  await withViews(async ({ DutyDetailPanel }) => {
    const support = DUTIES.find((duty) => duty.id === "support");
    const intelligence = DUTIES.find((duty) => duty.id === "intelligence");
    const supportHtml = renderToStaticMarkup(React.createElement(DutyDetailPanel, { duty: support }));
    const intelligenceHtml = renderToStaticMarkup(React.createElement(DutyDetailPanel, { duty: intelligence }));
    assert.match(supportHtml, /<details class="duty-detail" open="" aria-live="polite">/);
    assert.match(supportHtml, /Duty brief: Support/);
    assert.match(supportHtml, /Help fellow Rebels fulfill their Duties/);
    assert.doesNotMatch(supportHtml, /Source:|href=/);
    assert.match(intelligenceHtml, /Duty brief: Intelligence/);
    assert.notEqual(supportHtml, intelligenceHtml);
  });
});

test("playable sheet smoke renders tabs, trackers, roll entry points, and talent caution", async () => {
  await withViews(async (_, { CharacterSheet }) => {
    const props = { character: playableCharacter(), onChange: () => {}, onEdit: () => {} };
    const html = renderToStaticMarkup(React.createElement(CharacterSheet, props));
    ["Skills", "Combat", "Talents", "Gear", "Bio"].forEach((tab) => assert.match(html, new RegExp(`>${tab}<`)));
    assert.match(html, /Wounds/);
    assert.match(html, /Roll/);
    const gearHtml = renderToStaticMarkup(React.createElement(CharacterSheet, { ...props, initialTab: "Gear" }));
    const talentHtml = renderToStaticMarkup(React.createElement(CharacterSheet, { ...props, initialTab: "Talents" }));
    assert.match(gearHtml, /Critical injuries/);
    assert.match(talentHtml, /not verified or automated/);
  });
});
