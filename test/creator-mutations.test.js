import test from "node:test";
import assert from "node:assert/strict";
import { deriveCharacter } from "../src/companion/calculations.js";
import { changeSpecies, changeStartingCareer, changeStartingSpecialization } from "../src/companion/creatorMutations.js";
import { loadRoster, saveRoster, upsertCharacter } from "../src/companion/persistence.js";
import { createCharacter, createRoster, validateCharacter } from "../src/companion/schema.js";
import { replayTalentPurchases } from "../src/companion/talentCalculations.js";
import { purchaseTalentNode } from "../src/companion/talentMutations.js";

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

function savedRoundTrip(character) {
  const storage = new MemoryStorage();
  const saved = saveRoster(upsertCharacter(createRoster(), character), storage);
  assert.equal(saved.error, null);
  const loaded = loadRoster(storage);
  assert.equal(loaded.error, null);
  return loaded.roster.characters[0];
}

function assertValidRoundTrip(character, label) {
  const restored = savedRoundTrip(character);
  assert.deepEqual(validateCharacter(restored), [], `${label} remains saveable after loading`);
  assert.equal(replayTalentPurchases(restored).valid, true, `${label} keeps a valid ledger after loading`);
  assert.deepEqual(restored.talentPurchases, character.talentPurchases, `${label} preserves the purchase ledger after loading`);
  return restored;
}

test("changing a root identity clears a purchased talent ledger before persistence", () => {
  const purchased = purchaseTalentNode(completeCharacter(), "soldier:commando:r1c1");
  const changes = [
    ["species", changeSpecies(purchased, "duros"), (character) => {
      assert.equal(character.speciesId, "duros");
      assert.deepEqual(character.speciesTraining, []);
      assert.deepEqual(character.humanBonusTraining, []);
    }],
    ["career", changeStartingCareer(purchased, "ace"), (character) => {
      assert.equal(character.careerId, "ace");
      assert.equal(character.specializationId, "");
      assert.deepEqual(character.additionalSpecializationIds, []);
      assert.deepEqual(character.careerTraining, []);
      assert.deepEqual(character.specializationTraining, []);
      assert.deepEqual(character.purchasedSkillRanks, {});
      assert.deepEqual(character.purchasedSkillCosts, {});
    }],
    ["starting specialization", changeStartingSpecialization({ ...purchased, additionalSpecializationIds: ["soldier:medic"] }, "medic"), (character) => {
      assert.equal(character.specializationId, "medic");
      assert.deepEqual(character.additionalSpecializationIds, []);
      assert.deepEqual(character.specializationTraining, []);
      assert.deepEqual(character.purchasedSkillRanks, {});
      assert.deepEqual(character.purchasedSkillCosts, {});
    }]
  ];

  for (const [label, changed, verifyResets] of changes) {
    verifyResets(changed);
    assert.deepEqual(changed.talentPurchases, [], `${label} clears purchased nodes`);
    assert.deepEqual(replayTalentPurchases(changed).errors, [], `${label} leaves a structurally valid ledger`);
    assert.deepEqual(validateCharacter(changed), [], `${label} remains a saveable draft`);
    const restored = assertValidRoundTrip(changed, label);
    assert.deepEqual(restored.talentPurchases, [], `${label} persists an empty ledger`);
    assert.equal(deriveCharacter(restored).errors.some((error) => error.includes("talent purchase ledger")), false, `${label} keeps Experience recoverable`);
  }
});

test("same-value root updates are lossless and retain a valid persisted ledger", () => {
  const purchased = purchaseTalentNode(completeCharacter({
    speciesId: "gran",
    speciesTraining: ["charm"],
    additionalSpecializationIds: ["soldier:medic"]
  }), "soldier:commando:r1c1");
  const selections = [
    ["species", changeSpecies, "gran"],
    ["career", changeStartingCareer, "soldier"],
    ["starting specialization", changeStartingSpecialization, "commando"]
  ];

  for (const [label, select, selectedId] of selections) {
    const before = structuredClone(purchased);
    const unchanged = select(purchased, selectedId);
    assert.strictEqual(unchanged, purchased, `${label} selection returns the original character`);
    assert.deepEqual(unchanged, before, `${label} selection leaves every character field unchanged`);
    assert.equal(replayTalentPurchases(unchanged).valid, true, `${label} keeps a valid ledger`);
    assertValidRoundTrip(unchanged, `${label} selection`);
  }
});
