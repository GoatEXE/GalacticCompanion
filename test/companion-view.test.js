import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { BACKGROUNDS, DUTIES, SKILLS, SPECIALIZATIONS, SPECIES } from "../src/companion/catalog.js";
import { createCharacter } from "../src/companion/schema.js";
import { changeSpecies, changeStartingCareer, changeStartingSpecialization } from "../src/companion/creatorMutations.js";

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

test("Experience copy uses accessible section naming, callout placement, and concise skill/specialization notes", async () => {
  await withViews(async ({ CharacterCreator }) => {
    const html = renderToStaticMarkup(React.createElement(CharacterCreator, { character: playableCharacter(), initialStep: 5, onChange: () => {}, onOpenSheet: () => {} }));
    assert.match(html, /<section class="creator-step" aria-label="Experience">/);
    assert.doesNotMatch(html, /<h4[^>]*>Experience<\/h4>/);
    assert.doesNotMatch(html, /Spend starting XP\. Characteristics cost 10/);
    assert.match(html, /<h5 id="experience-characteristics-title">Characteristics<\/h5><p class="experience-rule-callout" role="note">Characteristics can only be increased during character creation\. They cannot exceed 5 unless otherwise noted\.<\/p>/);
    assert.match(html, /<h5 id="experience-skills-title">Skills<\/h5><p class="experience-skill-note">Starting ranks cannot exceed 2\.<\/p>/);
    assert.ok(html.indexOf("experience-characteristics-title") < html.indexOf("experience-rule-callout"));
    assert.ok(html.indexOf("experience-rule-callout") < html.indexOf("experience-skills-title"));
    assert.ok(html.indexOf("experience-skills-title") < html.indexOf("Skill pricing legend"));
    assert.ok(html.indexOf("experience-specializations-title") < html.indexOf("Specialization pricing legend"));
    assert.match(html, /<h5 id="experience-specializations-title">Specializations<\/h5><p class="experience-skill-note">Starting specialization is free\. Purchasing an additional specialization unlocks its skill tree\.<\/p><div class="skill-pricing-legend specialization-pricing-legend"/);
    assert.doesNotMatch(html, /Starting specialization is free\. Additional specializations grant career skills/);
  });
});

test("talent purchases leave tree disclosure state caller-controlled", async () => {
  const creatorSource = readFileSync(new URL("../src/companion/CharacterCreator.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(creatorSource, /\bconst openTree\b/);
  assert.doesNotMatch(creatorSource, /openTree\(node\.specializationGlobalId\)/);
  await withViews(async ({ TalentExperience }) => {
    const html = renderToStaticMarkup(React.createElement(TalentExperience, { character: playableCharacter(), onChange: () => {} }));
    assert.doesNotMatch(html, /<details class="talent-tree-details" open="">/);
    assert.match(html, /class="talent-purchase-row[^"]*"/);
  });
});

test("expanded talent nodes render derived prerequisite labels without exposing node identities", async () => {
  const nodeMarkup = (html, talentName, row, column) => [...html.matchAll(/<button type="button" class="talent-node[\s\S]*?<\/button>/g)].map(([markup]) => markup).find((markup) => markup.includes(`<b>${talentName}</b>`) && markup.includes(`data-row="${row}" data-column="${column}"`));
  const visibleNodeMarkup = (markup) => markup.replace(/<span id="[^"]+" class="sr-only">[^<]*<\/span>/g, "");
  await withViews(async ({ TalentExperience }) => {
    const initial = renderToStaticMarkup(React.createElement(TalentExperience, { character: playableCharacter(), onChange: () => {} }));
    const entry = nodeMarkup(initial, "Physical Training", 1, 1);
    const locked = nodeMarkup(initial, "Toughened", 2, 1);
    const deduped = nodeMarkup(initial, "Blooded", 3, 1);
    assert.match(entry, /class="talent-node-prerequisite">Prerequisite: None<\/span>/);
    assert.match(locked, /class="talent-node-prerequisite">Prerequisite: Physical Training or Durable or Blooded<\/span>/);
    assert.match(deduped, /class="talent-node-prerequisite">Prerequisite: Toughened or Armor Master<\/span>/);
    assert.doesNotMatch(visibleNodeMarkup(entry), /R\d C\d|soldier:commando|Connection:|Gains rank/);

    const reached = renderToStaticMarkup(React.createElement(TalentExperience, {
      character: { ...playableCharacter(), talentPurchases: [{ nodeId: "soldier:commando:r1c1", choices: {} }] }, onChange: () => {}
    }));
    const connected = nodeMarkup(reached, "Toughened", 2, 1);
    assert.match(connected, /talent-node-available/);
    assert.match(connected, /class="talent-node-prerequisite">Prerequisite: Physical Training<\/span>/);
    assert.match(connected, /class="talent-status talent-status-available">Available<\/span>/);
    assert.match(connected, /class="talent-node-cost">10 XP<\/span>/);
    assert.match(connected, /class="sr-only">R2 C1 · soldier:commando:r2c1\. Connection:/);
  });
});

test("talent experience lists eligible occurrences before collapsed owned trees with accessible node states", async () => {
  await withViews(async ({ TalentExperience }) => {
    const character = { ...playableCharacter(), talentPurchases: [{ nodeId: "soldier:commando:r1c1", choices: {} }] };
    const html = renderToStaticMarkup(React.createElement(TalentExperience, { character, onChange: () => {} }));
    assert.match(html, /<h5 id="experience-talents-title">Talents<\/h5>/);
    assert.match(html, /Purchase talents from your available specializations\. Talent effects are not automated\./);
    assert.match(html, /<section class="talent-purchase-options" aria-label="Available talent purchases">/);
    assert.doesNotMatch(html, /talent-purchase-options-title|>Purchasable now<|<h6[^>]*>Purchasable now<\/h6>/);
    assert.match(html, /class="button button-secondary talent-undo-button"[^>]*aria-describedby="talent-undo-help"/);
    assert.match(html, /<p id="talent-undo-help" class="sr-only talent-undo-help">Global LIFO undo:/);
    assert.match(html, /<p class="sr-only talent-live-region" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
    assert.match(html, /<details class="talent-tree-details"><summary>/);
    assert.doesNotMatch(html, /<details class="talent-tree-details" open="">/);
    assert.equal((html.match(/class="talent-node talent-node-/g) ?? []).length, 20);
    assert.match(html, /class="talent-connector-layer"[^>]*aria-hidden="true"/);
    assert.equal((html.match(/<line /g) ?? []).length > 0, true);
    assert.doesNotMatch(html, /marker-(?:start|mid|end)|<polygon|<path/);
    const purchaseStart = html.indexOf('<ul class="talent-purchase-list"');
    const treeStart = html.indexOf('<div class="talent-tree-list"');
    const purchaseMarkup = html.slice(purchaseStart, treeStart);
    assert.match(purchaseMarkup, /<b>Grit<\/b><span>Commando<\/span><\/div><p class="talent-purchase-description">Increases strain threshold by 1 per rank\.<\/p>/);
    assert.match(purchaseMarkup, /<strong class="talent-purchase-cost">5 XP<\/strong><button[^>]*aria-label="Purchase Grit for 5 XP">Purchase<\/button>/);
    assert.doesNotMatch(purchaseMarkup, /talent-purchase-details|talent-status|Affordable|Unaffordable|Connection:|Gains rank|R\d C\d|soldier:commando/);
    const treeMarkup = html.slice(treeStart);
    const firstTreeNodeStart = treeMarkup.indexOf('<button type="button" class="talent-node');
    const firstTreeNodeEnd = treeMarkup.indexOf('</button>', firstTreeNodeStart) + '</button>'.length;
    const firstTreeNode = treeMarkup.slice(firstTreeNodeStart, firstTreeNodeEnd);
    const visibleTreeNode = firstTreeNode.replace(/<span id="[^"]+" class="sr-only">[^<]*<\/span>/g, "");
    assert.match(firstTreeNode, /class="talent-node-description">Adds a boost per rank to Athletics and Resilience checks\.<\/span>/);
    assert.match(firstTreeNode, /class="talent-status talent-status-owned">Owned<\/span>/);
    assert.match(firstTreeNode, /class="talent-node-cost">5 XP<\/span>/);
    assert.match(firstTreeNode, /aria-label="Physical Training, Adds a boost per rank to Athletics and Resilience checks\., Owned, 5 XP, Prerequisite: None\." aria-describedby="talent-node-details-/);
    assert.match(firstTreeNode, /class="sr-only">R1 C1 · soldier:commando:r1c1\. Connection: top-row entry node\.<\/span>/);
    assert.doesNotMatch(treeMarkup, /talent-node-coordinate|talent-node-connection/);
    assert.doesNotMatch(visibleTreeNode, /R\d C\d|soldier:commando|Connection:|Gains rank/);
    assert.match(treeMarkup, /Owned elsewhere\/free when reached|>Owned<\/span>/);
    assert.match(treeMarkup, />Available<\/span>/);
    assert.match(treeMarkup, />Locked<\/span>/);
    assert.match(treeMarkup, /Connection: top-row entry node\./);
    assert.match(treeMarkup, /Source: <a href="https:\/\/online\.anyflip\.com\/ziisf\/jobq\/mobile\/index\.html#page=/);
    assert.match(html, /Global LIFO undo:/);

    const emptyUndo = renderToStaticMarkup(React.createElement(TalentExperience, {
      character: playableCharacter(), onChange: () => {}
    }));
    assert.match(emptyUndo, /<p id="talent-undo-help" class="sr-only talent-undo-help">No talent purchases to undo\.<\/p>/);
    assert.match(emptyUndo, /<p class="sr-only talent-live-region" role="status" aria-live="polite" aria-atomic="true"><\/p>/);

    const unaffordable = renderToStaticMarkup(React.createElement(TalentExperience, {
      character: { ...character, characteristicAdvances: { brawn: 4 } }, onChange: () => {}
    }));
    const unaffordableStart = unaffordable.indexOf('<ul class="talent-purchase-list"');
    const unaffordableTreeStart = unaffordable.indexOf('<div class="talent-tree-list"');
    const unaffordableMarkup = unaffordable.slice(unaffordableStart, unaffordableTreeStart);
    assert.match(unaffordableMarkup, /class="[^"]*talent-purchase-unaffordable"/);
    assert.match(unaffordableMarkup, /<strong class="talent-purchase-cost">5 XP<\/strong><button[^>]*disabled=""[^>]*aria-describedby="talent-purchase-help-/);
    assert.match(unaffordableMarkup, /class="sr-only">Requires \d+ additional XP\.<\/span>/);
    const visibleUnaffordableMarkup = unaffordableMarkup.replace(/<span id="[^"]+" class="sr-only">[^<]*<\/span>/g, "");
    assert.doesNotMatch(visibleUnaffordableMarkup, /Requires \d+ additional XP\.|Affordable|Unaffordable|Connection:|Gains rank|R\d C\d|soldier:commando/);
  });
});

test("Experience renders recovered root changes and an editable overspent talent draft", async () => {
  await withViews(async ({ CharacterCreator }) => {
    const purchased = {
      ...playableCharacter(),
      talentPurchases: [{ nodeId: "soldier:commando:r1c1", choices: {} }]
    };
    const rootChanges = [
      changeSpecies(purchased, "duros"),
      changeStartingCareer(purchased, "ace"),
      changeStartingSpecialization(purchased, "medic")
    ];
    for (const changed of rootChanges) {
      const html = renderToStaticMarkup(React.createElement(CharacterCreator, { character: changed, initialStep: 5, onChange: () => {}, onOpenSheet: () => {} }));
      assert.match(html, /id="experience-talents-title">Talents/);
      assert.doesNotMatch(html, /Invalid talent purchase ledger/);
      assert.doesNotMatch(html, /Talent purchase records need repair/);
    }

    const overspent = {
      ...playableCharacter(),
      dutyXpExchange: false,
      characteristicAdvances: { brawn: 3 },
      talentPurchases: [
        { nodeId: "soldier:commando:r1c1", choices: {} },
        { nodeId: "soldier:commando:r2c1", choices: {} }
      ]
    };
    const overspentHtml = renderToStaticMarkup(React.createElement(CharacterCreator, { character: overspent, initialStep: 5, onChange: () => {}, onOpenSheet: () => {} }));
    assert.match(overspentHtml, /XP spending exceeds the available budget\./);
    assert.match(overspentHtml, /class="button button-secondary talent-undo-button"[^>]*>Undo last talent/);
    assert.doesNotMatch(overspentHtml, /talent-undo-button"[^>]*disabled=""/);
    assert.match(overspentHtml, /Global LIFO undo:/);
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

test("talent controls share compact secondary sizing while preserving mobile touch targets", () => {
  assert.match(companionCss, /\.additional-specialization-list \.button,\.talent-undo-button,\.talent-purchase-action \.button \{ font-size: \.72rem; min-height: 2rem; padding-inline: \.55rem; \}/);
  assert.match(companionCss, /@media \(max-width: 640px\) \{[\s\S]*\.talent-undo-button,\.talent-purchase-action \.button \{ min-height: 2\.75rem; \}/);
  assert.match(companionCss, /\.talent-experience-heading h5 \{ color: var\(--text\); font-family: "Barlow Condensed",Impact,sans-serif; font-size: 1\.08rem; letter-spacing: \.08em; margin: 0 0 \.4rem; text-transform: uppercase; \}/);
  assert.match(companionCss, /\.talent-node-footer \{ align-items: baseline; display: flex; flex-wrap: wrap; gap: \.2rem \.45rem; min-width: 0; \}/);
  assert.match(companionCss, /\.talent-node-prerequisite \{ color: var\(--text-muted\); display: none;/);
  assert.match(companionCss, /@media \(max-width: 640px\) \{[\s\S]*\.talent-node-footer \{ display: grid; grid-template-columns: minmax\(0,1fr\) auto; width: 100%; \}[\s\S]*\.talent-node-prerequisite \{ display: block; font-size: \.61rem; grid-column: 1; grid-row: 1; justify-self: start;/);
  assert.match(companionCss, /\.talent-node-cost \{ color: var\(--crawl-yellow\); font-family: "IBM Plex Mono",monospace; font-size: \.62rem;/);
  assert.match(companionCss, /\.talent-connector-layer \{ height: calc\(100% - 1\.15rem\); inset: \.575rem 0; pointer-events: none;/);
  assert.match(companionCss, /\.talent-connector-layer line \{ stroke: var\(--alliance-red\); stroke-linecap: round; stroke-width: 2;/);
  assert.doesNotMatch(companionCss, /\.talent-connector-layer line \{[^}]*stroke-width: (?:0|0\.[0-9]+|1)(?:;|\s)/);
  assert.match(companionCss, /\.talent-node \{[^}]*background: var\(--raised\);/);
  assert.match(companionCss, /\.talent-node:hover:not\(:disabled\) \{ background: var\(--raised-hover\);/);
  assert.match(companionCss, /\.talent-node:disabled \{ background: var\(--raised\); cursor: not-allowed; opacity: 1; \}/);
  assert.match(companionCss, /@media \(max-width: 640px\) \{[\s\S]*\.talent-connector-layer \{ display: none; \}/);
  assert.doesNotMatch(companionCss, /\.talent-purchase-options > h6/);
});

test("specialization hierarchy keeps shared legend rhythm and has open/close motion", () => {
  assert.match(companionCss, /\.skill-pricing-legend \{[\s\S]*margin-top: 1rem/);
  assert.doesNotMatch(companionCss, /\.specialization-pricing-legend\s*\{[^}]*margin-top/);
  assert.match(companionCss, /out-career-menu\[open\] > \.hierarchy-details-content[\s\S]*specialization-hierarchy-open/);
  assert.match(companionCss, /out-career-menu\.is-closing > \.hierarchy-details-content[\s\S]*specialization-hierarchy-close/);
  assert.match(companionCss, /out-career-menu > summary::before,\.out-career-group > summary::before[\s\S]*transition: transform \.2s ease/);
  assert.match(companionCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*hierarchy-details-content \{ animation: none !important;/);
  assert.match(companionCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*summary::before \{ transition: none;/);
});

test("top-level experience sections use breathing room around dividers without changing internal gaps", () => {
  assert.match(companionCss, /\.experience-sections \{ display: grid; gap: 1\.25rem; \}/);
  assert.match(companionCss, /\.experience-subsection \{ border-top: 1px solid var\(--line\); padding-top: \.95rem; \}/);
  assert.doesNotMatch(companionCss, /\.experience-sections \{ display: grid; gap: 1rem; \}/);
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
