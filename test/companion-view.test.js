import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { BACKGROUNDS, DUTIES, SPECIES } from "../src/companion/catalog.js";
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
  await withViews(async ({ CharacterCreator, SpeciesSelect }) => {
    const html = renderToStaticMarkup(React.createElement(CharacterCreator, { character: playableCharacter(), onChange: () => {}, onOpenSheet: () => {} }));
    const speciesSelectHtml = renderToStaticMarkup(React.createElement(SpeciesSelect, { value: "gran", onChange: () => {}, describedBy: "species-help" }));
    assert.match(html, /Step 1 of 7/);
    ["Background", "Duty", "Species", "Career", "Specialization", "Experience", "Gear"].forEach((step) => assert.match(html, new RegExp(`>${step}<`)));
    assert.match(html, /Character budgets/);
    assert.match(html, /Background narrative/);
    assert.match(html, /aria-describedby="background-help"/);
    assert.match(html, /Optional inspiration/);
    assert.match(html, /class="inspiration-chip"/);
    assert.doesNotMatch(html, /class="choice-grid"/);
    assert.match(speciesSelectHtml, /id="species-select"/);
    assert.match(speciesSelectHtml, /aria-describedby="species-help"/);
    assert.match(speciesSelectHtml, /<option value="gran"(?: selected="")?>Gran<\/option>/);
    assert.doesNotMatch(speciesSelectHtml, /species-choice-grid|species-card/);
    assert.ok(html.indexOf("Operative name") < html.indexOf("Optional inspiration"));
    assert.ok(html.indexOf("Optional inspiration") < html.indexOf("Background narrative"));
  });
});

test("background inspiration prompts append as concise local narrative starters", async () => {
  await withViews(async ({ appendBackgroundPrompt }) => {
    const allianceRecruit = BACKGROUNDS.find((entry) => entry.id === "alliance-recruit");
    assert.equal(appendBackgroundPrompt("", allianceRecruit.prompt), allianceRecruit.prompt);
    assert.equal(appendBackgroundPrompt("A former courier.", allianceRecruit.prompt), `A former courier.\n\n${allianceRecruit.prompt}`);
  });
});

test("training skill badges use pressed buttons without visible checkbox inputs", async () => {
  await withViews(async ({ TrainingChooser }) => {
    const html = renderToStaticMarkup(React.createElement(TrainingChooser, { title: "Career training", skills: ["coercion", "cool"], selected: ["cool"], count: 1, onChange: () => {}, help: "Select free starting ranks." }));
    assert.match(html, /role="group" aria-label="Career training options"/);
    assert.match(html, /aria-pressed="false"/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /class="selected"/);
    assert.doesNotMatch(html, /type="checkbox"/);
    assert.doesNotMatch(html, /<input/);
    assert.match(html, /disabled=""/);
  });
});

test("species detail panel exposes source-linked stats, skills, and ability review notes", async () => {
  await withViews(async ({ SpeciesDetailPanel }) => {
    const gran = SPECIES.find((species) => species.id === "gran");
    const html = renderToStaticMarkup(React.createElement(SpeciesDetailPanel, { species: gran, selectedSkillIds: ["charm"] }));
    assert.match(html, /class="species-detail"/);
    assert.match(html, /Selected species/);
    assert.match(html, /Starting XP/);
    assert.match(html, /Characteristics/);
    assert.match(html, /Choose 1: Charm or Negotiation/);
    assert.match(html, /Chosen: Charm/);
    assert.match(html, /Enhanced Vision/);
    assert.match(html, /Table review/);
    assert.match(html, /href="https:\/\/online\.anyflip\.com\/ziisf\/jobq\/mobile\/index\.html#page=56"/);
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
    const bioHtml = renderToStaticMarkup(React.createElement(CharacterSheet, { ...props, character: { ...props.character, backgroundText: "A local narrative history." }, initialTab: "Bio" }));
    assert.match(bioHtml, /A local narrative history\./);
  });
});
