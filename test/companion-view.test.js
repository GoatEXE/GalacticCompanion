import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { BACKGROUNDS, DUTIES, SKILLS, SPECIALIZATIONS, SPECIES } from "../src/companion/catalog.js";
import { createCharacter } from "../src/companion/schema.js";

const companionCss = readFileSync(new URL("../src/styles/companion.css", import.meta.url), "utf8");

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

test("specialization undo is disabled with an accessible dependent-rank explanation", async () => {
  await withViews(async ({ AdditionalSpecializations }) => {
    const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
    const character = { ...createCharacter(), careerId: "soldier", specializationId: "commando", additionalSpecializationIds: [medic.globalId], purchasedSkillRanks: { "knowledge-xenology": 1 }, purchasedSkillCosts: { "knowledge-xenology": [{ cost: 5, career: true }] } };
    const html = renderToStaticMarkup(React.createElement(AdditionalSpecializations, { character, remainingXp: 100, onChange: () => {} }));
    assert.match(html, /disabled=""[^>]*aria-describedby="specialization-undo-help"/);
    assert.match(html, /Remove purchased Knowledge \(Xenology\) ranks/);
  });
});

test("additional specialization picker uses a visible legend and accessible row classifications", async () => {
  await withViews(async ({ AdditionalSpecializations }) => {
    const character = { ...createCharacter(), careerId: "soldier", specializationId: "commando" };
    const html = renderToStaticMarkup(React.createElement(AdditionalSpecializations, { character, remainingXp: 100, onChange: () => {} }));
    assert.match(html, /id="experience-specializations-title">Specializations/);
    assert.match(html, /aria-label="Specialization pricing legend"/);
    assert.match(html, />In-career</);
    assert.match(html, /Out-of-career/);
    assert.match(html, /class="career-key"/);
    assert.match(html, /class="non-career-key"/);
    const outerMenu = html.indexOf('<details class="out-career-menu"><summary aria-expanded="false">Other careers</summary>');
    assert.ok(outerMenu > 0);
    assert.ok(html.indexOf("<b>Sharpshooter</b>") < outerMenu);
    assert.ok(html.indexOf("<b>Recruit</b>") < outerMenu);
    assert.match(html, /<details class="out-career-group"><summary aria-expanded="false">Ace<\/summary>.*<b>Driver<\/b><small>Ace<\/small>/s);
    assert.match(html, /<details class="out-career-group"><summary aria-expanded="false">Commander<\/summary>/);
    assert.doesNotMatch(html, /<summary[^>]*>Soldier<\/summary>/);
    assert.match(html, /class="out-career-specialization"[^>]*>.*<b>Driver<\/b><small>Ace<\/small>/s);
    assert.match(html, /class="in-career-specialization"[^>]*>.*<b>Medic<\/b><small>Soldier<\/small>/s);
    assert.match(html, /class="in-career-specialization"[^>]*>.*<b>Recruit<\/b><small>Universal<\/small>/s);
    assert.match(html, /<span class="sr-only">Universal specialization, In-Career\.<\/span>/);
    assert.match(html, /<span class="sr-only">Out-of-Career\.<\/span>/);
    assert.doesNotMatch(html, /Universal · in-career cost|Out-of-career · Ace|<small>In-career<\/small>|<small>Out-of-career/);
    assert.match(html, /aria-label="Purchase Recruit for 20 XP"/);
    assert.doesNotMatch(html, />Commando<|Purchase Commando/);
    const aceIds = SPECIALIZATIONS.filter((entry) => entry.careerId === "ace").map((entry) => entry.globalId);
    const withoutAce = renderToStaticMarkup(React.createElement(AdditionalSpecializations, { character: { ...character, additionalSpecializationIds: aceIds }, remainingXp: 100, onChange: () => {} }));
    assert.doesNotMatch(withoutAce, /<summary[^>]*>Ace<\/summary>/);
    const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
    const ownedMedic = renderToStaticMarkup(React.createElement(AdditionalSpecializations, { character: { ...character, additionalSpecializationIds: [medic.globalId] }, remainingXp: 100, onChange: () => {} }));
    assert.match(ownedMedic, /Owned additions[\s\S]*Medic/);
    assert.doesNotMatch(ownedMedic, /<b>Medic<\/b><small>Soldier<\/small>/);
  });
});

test("specialization hierarchy has open/close motion, rotating indicators, and reduced-motion coverage", () => {
  assert.match(companionCss, /out-career-menu\[open\] > \.hierarchy-details-content[\s\S]*specialization-hierarchy-open/);
  assert.match(companionCss, /out-career-menu\.is-closing > \.hierarchy-details-content[\s\S]*specialization-hierarchy-close/);
  assert.match(companionCss, /out-career-menu > summary::before,\.out-career-group > summary::before[\s\S]*transition: transform \.2s ease/);
  assert.match(companionCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*hierarchy-details-content \{ animation: none !important;/);
  assert.match(companionCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*summary::before \{ transition: none;/);
});

test("experience skill rows use compact career indicators and an accessible legend", async () => {
  await withViews(async ({ SkillPurchaseList }) => {
    const character = { ...createCharacter(), careerId: "soldier", specializationId: "commando" };
    const ranks = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
    const html = renderToStaticMarkup(React.createElement(SkillPurchaseList, { character, ranks, remainingXp: 100, onPurchase: () => {} }));
    assert.match(html, /aria-label="Skill pricing legend"/);
    assert.match(html, /Career skill/);
    assert.match(html, /Non-career skill/);
    assert.match(html, /class="career-skill"/);
    assert.match(html, /class="non-career-skill"/);
    assert.equal((html.match(/class="purchase-skill-column"/g) ?? []).length, 2);
    assert.equal((html.match(/class="purchase-skill-group"/g) ?? []).length, 6);
    ["Brawn", "Agility", "Intellect", "Cunning", "Willpower", "Presence"].forEach((characteristic) => assert.match(html, new RegExp(`>${characteristic}<`)));
    const firstColumnStart = html.indexOf("<div class=\"purchase-skill-column\">");
    const secondColumnStart = html.indexOf("<div class=\"purchase-skill-column\">", firstColumnStart + 1);
    const firstColumn = html.slice(firstColumnStart, secondColumnStart);
    const secondColumn = html.slice(secondColumnStart);
    ["Brawn", "Agility", "Cunning"].forEach((characteristic) => assert.match(firstColumn, new RegExp(`>${characteristic}<`)));
    ["Intellect", "Willpower", "Presence"].forEach((characteristic) => assert.match(secondColumn, new RegExp(`>${characteristic}<`)));
    assert.doesNotMatch(firstColumn, />Intellect<|>Willpower<|>Presence</);
    assert.doesNotMatch(secondColumn, />Brawn<|>Agility<|>Cunning</);
    assert.doesNotMatch(html, /<small>career<\/small>|<small>non-career<\/small>/);
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
