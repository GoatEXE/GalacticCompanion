import test from "node:test";
import assert from "node:assert/strict";
import { BACKGROUNDS, CATALOG, CAREERS, CATALOG_VERSION, DUTIES, SPECIALIZATIONS, SPECIES, UNIVERSAL_SPECIALIZATIONS, validateCatalog } from "../src/companion/catalog.js";
import { additionalSpecializationCost, additionalSpecializationCosts, additionalSpecializationUndoBlockReason, createSkillPool, deriveCharacter, isCareerSkill, purchasedSkillCost, purchasedSkillCostEntries, selectedSkillRanks, skillPoolFor, specializationCost, xpSpent } from "../src/companion/calculations.js";
import { addImportedCharacter, deleteCharacter, loadRoster, saveRoster, upsertCharacter } from "../src/companion/persistence.js";
import { CHARACTER_EXPORT_KIND, CHARACTER_SCHEMA_VERSION, createCharacter, createRoster, exportCharacter, migrateCharacter, migrateRoster, parseCharacterImport, validateCharacter } from "../src/companion/schema.js";

function completeCharacter(overrides = {}) {
  return {
    ...createCharacter(),
    name: "Kessa Venn",
    backgroundId: "alliance-recruit",
    dutyId: "intelligence",
    speciesId: "bothan",
    careerId: "soldier",
    specializationId: "commando",
    careerTraining: ["athletics", "brawl", "knowledge-warfare", "medicine"],
    specializationTraining: ["brawl", "melee"],
    gearIds: ["combat-knife", "blaster-pistol"],
    ...overrides
  };
}

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test("versioned Core Rulebook catalogue is source-identified and structurally complete", () => {
  assert.equal(CATALOG.version, CATALOG_VERSION);
  assert.equal(CATALOG_VERSION, 2);
  assert.deepEqual(validateCatalog(), []);
  assert.equal(CATALOG.species.length, 8);
  assert.equal(CATALOG.careers.length, 6);
  assert.equal(CATALOG.careers.every((career) => career.skillIds.length === 8 && career.specializations.length === 3), true);
  assert.equal(CATALOG.careers.flatMap((career) => career.specializations).every((specialization) => specialization.skillIds.length === 4 && specialization.source.includes("Core Rulebook")), true);
  assert.deepEqual(DUTIES.find((duty) => duty.id === "support"), {
    id: "support", name: "Support",
    description: "Help fellow Rebels fulfill their Duties by providing the assistance they need, creating more chances to advance the cause together.",
    source: "Age of Rebellion Core Rulebook, p. 47",
    sourceUrl: "https://online.anyflip.com/ziisf/jobq/mobile/index.html#page=48"
  });
  assert.equal(DUTIES.length, 12);
  assert.equal(DUTIES.every((duty) => duty.description && duty.source && duty.sourceUrl), true);
  assert.deepEqual(validateCatalog({ ...CATALOG, careers: CATALOG.careers.slice(0, 5) }), ["Core catalogue must contain six unique careers."]);
});

test("all eight Core Rulebook species have audited bases and starting-rank metadata", () => {
  const actual = SPECIES.map(({ id, startingXp, woundBase, strainBase, characteristics, setup, source }) => ({
    id, startingXp, woundBase, strainBase,
    characteristics: [characteristics.brawn, characteristics.agility, characteristics.intellect, characteristics.cunning, characteristics.willpower, characteristics.presence],
    fixed: setup.startingSkillIds ?? [], choice: setup.startingSkillChoice?.skillIds ?? [], kind: setup.kind, source
  }));
  assert.deepEqual(actual, [
    { id: "human", startingXp: 110, woundBase: 10, strainBase: 10, characteristics: [2, 2, 2, 2, 2, 2], fixed: [], choice: [], kind: "human", source: "Age of Rebellion Core Rulebook, p. 56" },
    { id: "bothan", startingXp: 100, woundBase: 10, strainBase: 11, characteristics: [1, 2, 2, 3, 2, 2], fixed: ["streetwise"], choice: [], kind: "none", source: "Age of Rebellion Core Rulebook, p. 51" },
    { id: "droid", startingXp: 175, woundBase: 10, strainBase: 10, characteristics: [1, 1, 2, 1, 1, 1], fixed: [], choice: [], kind: "droid", source: "Age of Rebellion Core Rulebook, pp. 52–53" },
    { id: "duros", startingXp: 110, woundBase: 10, strainBase: 10, characteristics: [1, 2, 2, 2, 2, 2], fixed: ["piloting-space"], choice: [], kind: "none", source: "Age of Rebellion Core Rulebook, p. 54" },
    { id: "gran", startingXp: 100, woundBase: 10, strainBase: 11, characteristics: [2, 1, 2, 2, 2, 3], fixed: [], choice: ["charm", "negotiation"], kind: "none", source: "Age of Rebellion Core Rulebook, p. 55" },
    { id: "ithorian", startingXp: 100, woundBase: 12, strainBase: 9, characteristics: [3, 1, 2, 2, 2, 2], fixed: ["survival"], choice: [], kind: "none", source: "Age of Rebellion Core Rulebook, p. 57" },
    { id: "mon-calamari", startingXp: 100, woundBase: 10, strainBase: 10, characteristics: [1, 2, 3, 2, 2, 2], fixed: ["knowledge-education"], choice: [], kind: "none", source: "Age of Rebellion Core Rulebook, pp. 58–59" },
    { id: "sullustan", startingXp: 100, woundBase: 10, strainBase: 11, characteristics: [1, 3, 2, 2, 2, 2], fixed: ["astrogation"], choice: [], kind: "none", source: "Age of Rebellion Core Rulebook, p. 60" }
  ]);
  assert.equal(SPECIES.every((entry) => entry.sourcePage && entry.sourceUrl && entry.abilities.length > 0), true);
  assert.equal(SPECIES.find((entry) => entry.id === "droid").abilities.some((ability) => ability.name === "Mechanical Being"), true);
  assert.equal(SPECIES.find((entry) => entry.id === "gran").abilities.some((ability) => ability.name === "Enhanced Vision" && ability.tableReview), true);
});

test("species validation keeps the required Core baseline while allowing future additions", () => {
  const extraSpecies = { ...SPECIES[0], id: "future-species", name: "Future species" };
  assert.deepEqual(validateCatalog({ ...CATALOG, species: [...CATALOG.species, extraSpecies] }), []);
  assert.deepEqual(validateCatalog({ ...CATALOG, species: [...CATALOG.species, { ...extraSpecies, id: "human" }] }), ["Species ids must be unique."]);
  assert.equal(validateCatalog({ ...CATALOG, species: CATALOG.species.filter((entry) => entry.id !== "human") }).includes("Core catalogue must include all eight required Core Rulebook species."), true);
  assert.equal(validateCatalog({ ...CATALOG, species: [...CATALOG.species, { ...extraSpecies, startingXp: 0 }] }).includes("Invalid species: future-species."), true);
});

test("all six careers and eighteen starting specializations match the Core Rulebook skill catalogue", () => {
  const actual = CAREERS.map((career) => ({
    id: career.id, skills: career.skillIds, source: career.source,
    specializations: career.specializations.map((specialization) => ({ id: specialization.id, skills: specialization.skillIds, source: specialization.source }))
  }));
  assert.deepEqual(actual, [
    { id: "ace", skills: ["astrogation", "cool", "gunnery", "mechanics", "perception", "piloting-planetary", "piloting-space", "ranged-light"], source: "Age of Rebellion Core Rulebook, p. 64", specializations: [
      { id: "driver", skills: ["cool", "gunnery", "mechanics", "piloting-planetary"], source: "Age of Rebellion Core Rulebook, p. 65" },
      { id: "gunner", skills: ["discipline", "gunnery", "ranged-heavy", "resilience"], source: "Age of Rebellion Core Rulebook, p. 66" },
      { id: "pilot", skills: ["astrogation", "gunnery", "piloting-planetary", "piloting-space"], source: "Age of Rebellion Core Rulebook, p. 67" }
    ] },
    { id: "commander", skills: ["coercion", "cool", "discipline", "knowledge-warfare", "leadership", "perception", "ranged-light", "vigilance"], source: "Age of Rebellion Core Rulebook, p. 70", specializations: [
      { id: "commodore", skills: ["astrogation", "computers", "knowledge-education", "knowledge-outer-rim"], source: "Age of Rebellion Core Rulebook, p. 71" },
      { id: "squadron-leader", skills: ["gunnery", "mechanics", "piloting-planetary", "piloting-space"], source: "Age of Rebellion Core Rulebook, p. 72" },
      { id: "tactician", skills: ["brawl", "discipline", "leadership", "ranged-heavy"], source: "Age of Rebellion Core Rulebook, p. 73" }
    ] },
    { id: "diplomat", skills: ["charm", "deception", "knowledge-core-worlds", "knowledge-lore", "knowledge-outer-rim", "knowledge-xenology", "leadership", "negotiation"], source: "Age of Rebellion Core Rulebook, p. 77", specializations: [
      { id: "ambassador", skills: ["charm", "discipline", "knowledge-core-worlds", "negotiation"], source: "Age of Rebellion Core Rulebook, p. 79" },
      { id: "agitator", skills: ["coercion", "deception", "knowledge-underworld", "streetwise"], source: "Age of Rebellion Core Rulebook, p. 80" },
      { id: "quartermaster", skills: ["computers", "negotiation", "skulduggery", "vigilance"], source: "Age of Rebellion Core Rulebook, p. 81" }
    ] },
    { id: "engineer", skills: ["athletics", "computers", "knowledge-education", "mechanics", "perception", "piloting-space", "ranged-light", "vigilance"], source: "Age of Rebellion Core Rulebook, p. 82", specializations: [
      { id: "mechanic", skills: ["brawl", "mechanics", "piloting-space", "skulduggery"], source: "Age of Rebellion Core Rulebook, p. 83" },
      { id: "saboteur", skills: ["coordination", "mechanics", "skulduggery", "stealth"], source: "Age of Rebellion Core Rulebook, p. 84" },
      { id: "scientist", skills: ["computers", "knowledge-education", "knowledge-lore", "medicine"], source: "Age of Rebellion Core Rulebook, p. 85" }
    ] },
    { id: "soldier", skills: ["athletics", "brawl", "knowledge-warfare", "medicine", "melee", "ranged-light", "ranged-heavy", "survival"], source: "Age of Rebellion Core Rulebook, p. 88", specializations: [
      { id: "commando", skills: ["brawl", "melee", "resilience", "survival"], source: "Age of Rebellion Core Rulebook, p. 89" },
      { id: "medic", skills: ["knowledge-xenology", "medicine", "resilience", "vigilance"], source: "Age of Rebellion Core Rulebook, p. 90" },
      { id: "sharpshooter", skills: ["cool", "perception", "ranged-heavy", "ranged-light"], source: "Age of Rebellion Core Rulebook, p. 91" }
    ] },
    { id: "spy", skills: ["computers", "cool", "coordination", "deception", "knowledge-warfare", "perception", "skulduggery", "stealth"], source: "Age of Rebellion Core Rulebook, p. 94", specializations: [
      { id: "infiltrator", skills: ["deception", "melee", "skulduggery", "streetwise"], source: "Age of Rebellion Core Rulebook, p. 95" },
      { id: "scout", skills: ["athletics", "medicine", "piloting-planetary", "survival"], source: "Age of Rebellion Core Rulebook, p. 96" },
      { id: "slicer", skills: ["computers", "knowledge-education", "knowledge-underworld", "stealth"], source: "Age of Rebellion Core Rulebook, p. 97" }
    ] }
  ]);
});

test("background inspirations retain concise labels and narrative starter prompts", () => {
  const allianceRecruit = BACKGROUNDS.find((entry) => entry.id === "alliance-recruit");
  assert.deepEqual(allianceRecruit, {
    id: "alliance-recruit", name: "Alliance recruit",
    prompt: "I joined the Alliance after seeing the Empire harm people I care about."
  });
  assert.equal(BACKGROUNDS.every((entry) => entry.prompt.length > entry.name.length), true);
});

test("freeform background narrative can complete a character without an official background category", () => {
  const character = completeCharacter({ backgroundId: "", backgroundText: "A farmhand joined the Alliance after Imperial confiscations." });
  assert.deepEqual(validateCharacter(character, { requireComplete: true }), []);
  const blankNarrative = completeCharacter({ backgroundId: "", backgroundText: "" });
  assert.equal(validateCharacter(blankNarrative, { requireComplete: true }).includes("Write a Background narrative."), true);
});

test("valid core character passes schema completion and derives starter budgets", () => {
  const character = completeCharacter();
  assert.deepEqual(validateCharacter(character, { requireComplete: true }), []);
  const derived = deriveCharacter(character);
  assert.equal(derived.isPlayable, true);
  assert.equal(derived.xp.budget, 100);
  assert.equal(derived.credits.budget, 500);
  assert.equal(derived.credits.remaining, 75);
  assert.equal(derived.woundThreshold, 11);
  assert.equal(derived.strainThreshold, 13);
  assert.deepEqual(selectedSkillRanks(character).brawl, 2);
  assert.equal(selectedSkillRanks(character).streetwise, 1);
});

test("additional specializations use ordered costs, grant career skills, and never grant free ranks", () => {
  const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
  const pilot = SPECIALIZATIONS.find((entry) => entry.id === "pilot");
  const recruit = UNIVERSAL_SPECIALIZATIONS[0];
  const character = completeCharacter();
  assert.equal(specializationCost(character, medic.globalId), 20);
  assert.equal(specializationCost(character, pilot.globalId), 30);
  assert.equal(specializationCost(character, recruit.globalId), 20);
  const purchased = completeCharacter({ additionalSpecializationIds: [medic.globalId, pilot.globalId] });
  assert.deepEqual(additionalSpecializationCosts(purchased).map((entry) => entry.cost), [20, 40]);
  assert.equal(specializationCost(purchased, medic.globalId), 40);
  assert.equal(xpSpent(purchased), 60);
  assert.equal(isCareerSkill(purchased, "knowledge-xenology"), true);
  assert.equal(isCareerSkill(purchased, "astrogation"), true);
  assert.equal(selectedSkillRanks(purchased)["knowledge-xenology"], 0);
  assert.equal(deriveCharacter(purchased).errors.includes("XP spending exceeds the available budget."), false);
});

test("skill purchase snapshots preserve historical pricing across specialization changes", () => {
  const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
  const beforeSpecialization = completeCharacter({ purchasedSkillRanks: { "knowledge-xenology": 1 }, purchasedSkillCosts: { "knowledge-xenology": [{ cost: 10, career: false }] } });
  const afterSpecialization = { ...beforeSpecialization, additionalSpecializationIds: [medic.globalId] };
  assert.equal(purchasedSkillCost(afterSpecialization, "knowledge-xenology"), 10);
  const laterRank = { ...afterSpecialization, purchasedSkillRanks: { "knowledge-xenology": 2 }, purchasedSkillCosts: { "knowledge-xenology": [{ cost: 10, career: false }, { cost: 10, career: true }] } };
  assert.deepEqual(purchasedSkillCostEntries(laterRank, "knowledge-xenology").map((entry) => entry.cost), [10, 10]);
  assert.equal(purchasedSkillCost(laterRank, "knowledge-xenology"), 20);
  const legacy = completeCharacter({ additionalSpecializationIds: [medic.globalId], purchasedSkillRanks: { "knowledge-xenology": 1 } });
  assert.equal(purchasedSkillCost(legacy, "knowledge-xenology"), 10);
});

test("specialization undo blocks dependent career-priced ranks but allows safe history", () => {
  const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
  const recruit = UNIVERSAL_SPECIALIZATIONS[0];
  const dependent = completeCharacter({ additionalSpecializationIds: [medic.globalId], purchasedSkillRanks: { "knowledge-xenology": 1 }, purchasedSkillCosts: { "knowledge-xenology": [{ cost: 5, career: true }] } });
  assert.match(additionalSpecializationUndoBlockReason(dependent), /Remove purchased Knowledge \(Xenology\) ranks/);
  const boughtBefore = completeCharacter({ additionalSpecializationIds: [medic.globalId], purchasedSkillRanks: { "knowledge-xenology": 1 }, purchasedSkillCosts: { "knowledge-xenology": [{ cost: 15, career: false }] } });
  assert.equal(additionalSpecializationUndoBlockReason(boughtBefore), "");
  const retainedByOther = completeCharacter({ additionalSpecializationIds: [medic.globalId, recruit.globalId], purchasedSkillRanks: { "knowledge-xenology": 1 }, purchasedSkillCosts: { "knowledge-xenology": [{ cost: 5, career: true }] } });
  assert.equal(additionalSpecializationUndoBlockReason(retainedByOther), "");
});

test("Human bonus skills remain based on starting career and specialization", () => {
  const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
  const human = completeCharacter({ speciesId: "human", humanBonusTraining: ["knowledge-xenology", "charm"], additionalSpecializationIds: [medic.globalId] });
  assert.deepEqual(validateCharacter(human, { requireComplete: true }), []);
  assert.equal(isCareerSkill(human, "knowledge-xenology"), true);
});

test("duplicate additional specialization ownership is rejected, including the starting specialization", () => {
  const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
  const commando = SPECIALIZATIONS.find((entry) => entry.id === "commando");
  const duplicate = completeCharacter({ additionalSpecializationIds: [medic.globalId, medic.globalId] });
  assert.throws(() => migrateCharacter(duplicate), /distinct known specializations/);
  assert.throws(() => parseCharacterImport(JSON.stringify({ kind: CHARACTER_EXPORT_KIND, schemaVersion: CHARACTER_SCHEMA_VERSION, character: duplicate })), /distinct known specializations/);
  assert.throws(() => migrateCharacter(completeCharacter({ additionalSpecializationIds: [commando.globalId] })), /purchased twice/);
  assert.equal(validateCharacter(completeCharacter({ additionalSpecializationIds: [medic.globalId, medic.globalId] })).some((error) => error.includes("distinct known")), true);
  assert.equal(new Set(SPECIALIZATIONS.map((entry) => entry.globalId)).size, SPECIALIZATIONS.length);
});

test("automatic and selected species ranks affect caps, XP, and roll pools without charging a free rank", () => {
  const bothan = completeCharacter({ purchasedSkillRanks: { streetwise: 1 } });
  assert.equal(selectedSkillRanks(bothan).streetwise, 2);
  assert.equal(purchasedSkillCost(bothan, "streetwise"), 15);
  assert.equal(xpSpent(bothan), 15);
  assert.deepEqual(skillPoolFor(bothan, "streetwise"), { proficiency: 2, ability: 1, boost: 0, challenge: 0, difficulty: 2, setback: 0 });

  const granMissingChoice = completeCharacter({ speciesId: "gran" });
  assert.equal(deriveCharacter(granMissingChoice).errors.includes("Select the required species starting skill rank."), true);
  const gran = completeCharacter({ speciesId: "gran", speciesTraining: ["negotiation"] });
  assert.equal(deriveCharacter(gran).isPlayable, true);
  assert.equal(selectedSkillRanks(gran).negotiation, 1);

  const overCap = completeCharacter({ speciesId: "duros", careerId: "ace", specializationId: "pilot", careerTraining: ["astrogation", "cool", "gunnery", "piloting-space"], specializationTraining: ["piloting-space", "gunnery"] });
  assert.equal(validateCharacter(overCap).includes("Skills cannot exceed rank 2 during character creation."), true);
});

test("fixed species grants and Human and Droid training exceptions are retained", () => {
  for (const [speciesId, skillId] of [["bothan", "streetwise"], ["duros", "piloting-space"], ["ithorian", "survival"], ["mon-calamari", "knowledge-education"], ["sullustan", "astrogation"]]) {
    assert.equal(selectedSkillRanks(completeCharacter({ speciesId }))[skillId], 1, `${speciesId} receives ${skillId}`);
  }
  const human = completeCharacter({ speciesId: "human", humanBonusTraining: ["charm", "coercion"] });
  assert.equal(deriveCharacter(human).isPlayable, true);
  assert.equal(selectedSkillRanks(human).charm, 1);
  assert.equal(selectedSkillRanks(human).coercion, 1);

  const droid = completeCharacter({
    speciesId: "droid",
    careerTraining: ["athletics", "brawl", "knowledge-warfare", "medicine", "melee", "ranged-light"],
    specializationTraining: ["brawl", "melee", "resilience"]
  });
  assert.equal(deriveCharacter(droid).isPlayable, true);
  assert.equal(droid.careerTraining.length, 6);
  assert.equal(droid.specializationTraining.length, 3);
});

test("XP and gear budgets flag overspending without allowing a playable file", () => {
  const character = completeCharacter({
    characteristicAdvances: { brawn: 3, agility: 3, intellect: 3, cunning: 3, willpower: 3, presence: 3 },
    gearIds: ["blaster-rifle", "padded-armor"]
  });
  const derived = deriveCharacter(character);
  assert.equal(derived.isPlayable, false);
  assert.equal(derived.errors.includes("XP spending exceeds the available budget."), true);
  assert.equal(derived.errors.includes("Gear cost exceeds available credits."), true);
});

test("lowest starting characteristics can advance to the creation cap without migration loss", () => {
  const character = completeCharacter({ characteristicAdvances: { brawn: 4 } });
  const derived = deriveCharacter(character);
  assert.equal(derived.characteristics.brawn, 5);
  assert.equal(validateCharacter(character).includes("Invalid characteristic advances."), false);
});

test("skill pools use the higher value for size and lower value for upgrades", () => {
  assert.deepEqual(createSkillPool(3, 2), { proficiency: 2, ability: 1, boost: 0, challenge: 0, difficulty: 2, setback: 0 });
  assert.deepEqual(createSkillPool(2, 2), { proficiency: 2, ability: 0, boost: 0, challenge: 0, difficulty: 2, setback: 0 });
  assert.deepEqual(createSkillPool(1, 2), { proficiency: 1, ability: 1, boost: 0, challenge: 0, difficulty: 2, setback: 0 });
});

test("version-one drafts migrate safely: fixed grants apply and Gran remains editable until its choice is made", () => {
  const legacyBothan = { ...completeCharacter(), schemaVersion: 1 };
  const migratedBothan = migrateCharacter(legacyBothan);
  assert.equal(migratedBothan.schemaVersion, 2);
  assert.equal(migratedBothan.backgroundText, "");
  assert.deepEqual(migratedBothan.speciesTraining, []);
  assert.equal(selectedSkillRanks(migratedBothan).streetwise, 1);
  const migratedSkill = migrateCharacter({ ...completeCharacter({ purchasedSkillRanks: { "knowledge-xenology": 1 } }), schemaVersion: 1 });
  assert.deepEqual(migratedSkill.purchasedSkillCosts["knowledge-xenology"], [{ cost: 10, career: false }]);

  const migratedGran = migrateCharacter({ ...completeCharacter({ speciesId: "gran" }), schemaVersion: 1 });
  assert.deepEqual(migratedGran.speciesTraining, []);
  assert.equal(deriveCharacter(migratedGran).errors.includes("Select the required species starting skill rank."), true);
});

test("roster migration accepts v0 array data and retains a valid active character", () => {
  const character = completeCharacter();
  const migrated = migrateRoster([character]);
  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.activeCharacterId, character.id);
  assert.equal(migrated.characters.length, 1);
});

test("local persistence saves multiple files and deletion adjusts the active selection", () => {
  const storage = new MemoryStorage();
  const first = completeCharacter();
  const second = completeCharacter({ ...createCharacter(), name: "Second file" });
  let roster = upsertCharacter(createRoster(), first);
  roster = upsertCharacter(roster, second);
  const written = saveRoster(roster, storage);
  assert.equal(written.error, null);
  const restored = loadRoster(storage);
  assert.equal(restored.error, null);
  assert.equal(restored.roster.characters.length, 2);
  const afterDelete = deleteCharacter(restored.roster, second.id);
  assert.equal(afterDelete.characters.length, 1);
  assert.equal(afterDelete.activeCharacterId, first.id);
});

test("JSON export/import round-trips current and version-one files and rejects untrusted content", () => {
  const medic = SPECIALIZATIONS.find((entry) => entry.id === "medic");
  const character = completeCharacter({ additionalSpecializationIds: [medic.globalId] });
  const exported = exportCharacter(character);
  const imported = parseCharacterImport(exported);
  assert.equal(imported.name, character.name);
  assert.deepEqual(imported.additionalSpecializationIds, character.additionalSpecializationIds);
  assert.equal(JSON.parse(exported).kind, CHARACTER_EXPORT_KIND);
  assert.equal(JSON.parse(exported).schemaVersion, CHARACTER_SCHEMA_VERSION);
  const versionOne = parseCharacterImport(JSON.stringify({ kind: CHARACTER_EXPORT_KIND, schemaVersion: 1, character: { ...character, schemaVersion: 1 } }));
  assert.equal(versionOne.schemaVersion, 2);
  assert.throws(() => parseCharacterImport("not json"), /not valid JSON/);
  assert.throws(() => parseCharacterImport(JSON.stringify({ kind: CHARACTER_EXPORT_KIND, schemaVersion: 99, character })), /Unsupported import schema version/);
  assert.throws(() => parseCharacterImport(JSON.stringify({ kind: CHARACTER_EXPORT_KIND, schemaVersion: 1, character: { ...character, speciesId: "unknown" } })), /Unknown species/);
});

test("import collision keeps both local character files", () => {
  const character = completeCharacter();
  const roster = upsertCharacter(createRoster(), character);
  const withCopy = addImportedCharacter(roster, character);
  assert.equal(withCopy.characters.length, 2);
  assert.notEqual(withCopy.characters[0].id, withCopy.characters[1].id);
});
