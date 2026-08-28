import { BACKGROUNDS, DUTIES, SKILLS, findCareer, findGear, findSpecialization, findSpecies, speciesGrantedSkillIds } from "./catalog.js";

export const CHARACTER_SCHEMA_VERSION = 2;
export const ROSTER_SCHEMA_VERSION = 1;
export const CHARACTER_EXPORT_KIND = "aor-companion-character";

const characteristicKeys = ["brawn", "agility", "intellect", "cunning", "willpower", "presence"];
const skillIds = new Set(SKILLS.map((skill) => skill.id));
const backgroundIds = new Set(BACKGROUNDS.map((entry) => entry.id));
const dutyIds = new Set(DUTIES.map((entry) => entry.id));

function now() { return new Date().toISOString(); }
function id() { return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
function string(value, fallback = "") { return typeof value === "string" ? value : fallback; }
function array(value) { return Array.isArray(value) ? value : []; }
function integer(value, fallback = 0, min = 0, max = 999) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
function unique(values) { return new Set(values).size === values.length; }

export function createCharacter() {
  const timestamp = now();
  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: id(),
    createdAt: timestamp,
    updatedAt: timestamp,
    name: "New operative",
    backgroundId: "",
    backgroundText: "",
    dutyId: "",
    startingDuty: 10,
    dutyXpExchange: false,
    dutyCreditExchange: false,
    speciesId: "",
    careerId: "",
    specializationId: "",
    careerTraining: [],
    specializationTraining: [],
    humanBonusTraining: [],
    speciesTraining: [],
    characteristicAdvances: {},
    purchasedSkillRanks: {},
    gearIds: [],
    bio: { motivation: "", notes: "" },
    play: { wounds: 0, strain: 0, criticals: [] }
  };
}

/** Coerces old/plain JSON to the current shape, then validates it. */
export function migrateCharacter(value) {
  if (!value || typeof value !== "object") throw new Error("Character must be an object.");
  if (value.schemaVersion !== undefined && ![1, CHARACTER_SCHEMA_VERSION].includes(value.schemaVersion)) {
    throw new Error(`Unsupported character schema version: ${value.schemaVersion}.`);
  }
  const base = createCharacter();
  const character = {
    ...base,
    ...value,
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    id: string(value.id, base.id),
    createdAt: string(value.createdAt, base.createdAt),
    updatedAt: string(value.updatedAt, base.updatedAt),
    name: string(value.name, base.name).trim().slice(0, 80) || base.name,
    backgroundId: string(value.backgroundId),
    backgroundText: string(value.backgroundText).slice(0, 2000),
    dutyId: string(value.dutyId),
    startingDuty: integer(value.startingDuty, 10, 0, 20),
    dutyXpExchange: value.dutyXpExchange === true,
    dutyCreditExchange: value.dutyCreditExchange === true,
    speciesId: string(value.speciesId),
    careerId: string(value.careerId),
    specializationId: string(value.specializationId),
    careerTraining: array(value.careerTraining).map(String),
    specializationTraining: array(value.specializationTraining).map(String),
    humanBonusTraining: array(value.humanBonusTraining).map(String),
    // Version-one drafts did not persist a species choice. Keep them safe and
    // editable: fixed species ranks remain automatic, while Gran prompts for
    // its one required choice before the draft can be completed.
    speciesTraining: array(value.speciesTraining).map(String),
    characteristicAdvances: Object.fromEntries(characteristicKeys.map((key) => [key, integer(value.characteristicAdvances?.[key], 0, 0, 4)])),
    purchasedSkillRanks: Object.fromEntries(Object.entries(value.purchasedSkillRanks ?? {}).map(([key, rank]) => [key, integer(rank, 0, 0, 2)])),
    gearIds: array(value.gearIds).map(String),
    bio: { motivation: string(value.bio?.motivation).slice(0, 240), notes: string(value.bio?.notes).slice(0, 2000) },
    play: {
      wounds: integer(value.play?.wounds), strain: integer(value.play?.strain),
      criticals: array(value.play?.criticals).map((critical) => ({ id: string(critical?.id, id()), label: string(critical?.label, "Critical injury").slice(0, 120) })).slice(0, 20)
    }
  };
  const errors = validateCharacter(character);
  if (errors.length) throw new Error(errors.join(" "));
  return character;
}

export function validateCharacter(character, { requireComplete = false } = {}) {
  const errors = [];
  if (!character || typeof character !== "object") return ["Character must be an object."];
  if (character.schemaVersion !== CHARACTER_SCHEMA_VERSION) errors.push("Character schema version is not supported.");
  if (!character.id || typeof character.id !== "string") errors.push("Character id is required.");
  if (!character.name || typeof character.name !== "string") errors.push("Character name is required.");
  if (character.backgroundId && !backgroundIds.has(character.backgroundId)) errors.push("Unknown background.");
  if (typeof character.backgroundText !== "string") errors.push("Background narrative must be text.");
  if (character.dutyId && !dutyIds.has(character.dutyId)) errors.push("Unknown Duty.");
  if (!Number.isInteger(character.startingDuty) || character.startingDuty < 0 || character.startingDuty > 20) errors.push("Starting Duty must be between 0 and 20.");
  if (character.dutyXpExchange && character.startingDuty < 5) errors.push("Not enough Duty for the XP exchange.");
  if (character.dutyCreditExchange && character.startingDuty - (character.dutyXpExchange ? 5 : 0) < 5) errors.push("Not enough Duty for the credit exchange.");
  const selectedSpecies = character.speciesId && findSpecies(character.speciesId);
  if (character.speciesId && !selectedSpecies) errors.push("Unknown species.");
  const career = character.careerId && findCareer(character.careerId);
  if (character.careerId && !career) errors.push("Unknown career.");
  const specialization = character.specializationId && findSpecialization(character.careerId, character.specializationId);
  if (character.specializationId && !specialization) errors.push("Specialization does not belong to selected career.");
  const allTraining = [character.careerTraining, character.specializationTraining, character.humanBonusTraining, character.speciesTraining];
  allTraining.forEach((choices) => {
    if (!Array.isArray(choices) || !choices.every((skillId) => skillIds.has(skillId)) || !unique(choices)) errors.push("Training choices must contain distinct known skills.");
  });
  if (career && !character.careerTraining.every((skillId) => career.skillIds.includes(skillId))) errors.push("Career training contains a non-career skill.");
  if (specialization && !character.specializationTraining.every((skillId) => specialization.skillIds.includes(skillId))) errors.push("Specialization training contains an invalid skill.");
  const speciesChoice = selectedSpecies?.setup?.startingSkillChoice;
  if (character.speciesTraining.length && !speciesChoice) errors.push("This species has no selectable starting skill rank.");
  if (speciesChoice && !character.speciesTraining.every((skillId) => speciesChoice.skillIds.includes(skillId))) errors.push("Species training contains an invalid skill.");
  if (selectedSpecies?.setup?.kind !== "human" && character.humanBonusTraining.length) errors.push("Only humans receive human bonus skills.");
  if (selectedSpecies?.setup?.kind === "human" && (career || specialization) && character.humanBonusTraining.some((skillId) => career?.skillIds.includes(skillId) || specialization?.skillIds.includes(skillId))) errors.push("Human bonus skills must be non-career skills.");
  if (requireComplete) {
    if (!character.backgroundId && !(typeof character.backgroundText === "string" && character.backgroundText.trim())) errors.push("Write a Background narrative.");
    if (!character.dutyId) errors.push("Choose a Duty.");
    if (!selectedSpecies) errors.push("Choose a species.");
    if (!career) errors.push("Choose a career.");
    if (!specialization) errors.push("Choose a specialization.");
    if (career && character.careerTraining.length !== (selectedSpecies?.setup?.kind === "droid" ? 6 : 4)) errors.push("Select the required number of career training skills.");
    if (specialization && character.specializationTraining.length !== (selectedSpecies?.setup?.kind === "droid" ? 3 : 2)) errors.push("Select the required number of specialization training skills.");
    if (selectedSpecies?.setup?.kind === "human" && character.humanBonusTraining.length !== 2) errors.push("Humans select two different bonus skills.");
    if (speciesChoice && character.speciesTraining.length !== speciesChoice.count) errors.push("Select the required species starting skill rank.");
  }
  if (selectedSpecies) {
    const rankCounts = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
    [character.careerTraining, character.specializationTraining, character.humanBonusTraining, speciesGrantedSkillIds(selectedSpecies, character.speciesTraining), ...Object.entries(character.purchasedSkillRanks ?? {}).flatMap(([skillId, rank]) => Array(integer(rank)).fill(skillId))].flat().forEach((skillId) => {
      if (skillId in rankCounts) rankCounts[skillId] += 1;
    });
    if (Object.values(rankCounts).some((rank) => rank > 2)) errors.push("Skills cannot exceed rank 2 during character creation.");
  }
  if (!character.characteristicAdvances || Object.entries(character.characteristicAdvances).some(([key, amount]) => !characteristicKeys.includes(key) || !Number.isInteger(amount) || amount < 0 || amount > 4)) errors.push("Invalid characteristic advances.");
  if (!character.purchasedSkillRanks || Object.entries(character.purchasedSkillRanks).some(([key, rank]) => !skillIds.has(key) || !Number.isInteger(rank) || rank < 0 || rank > 2)) errors.push("Invalid purchased skill ranks.");
  if (!Array.isArray(character.gearIds) || !character.gearIds.every((gearId) => findGear(gearId)) || !unique(character.gearIds)) errors.push("Gear must contain distinct catalogue items.");
  if (!character.play || !Number.isInteger(character.play.wounds) || !Number.isInteger(character.play.strain) || !Array.isArray(character.play.criticals)) errors.push("Invalid play trackers.");
  return errors;
}

export function getCharacterCompletionErrors(character) { return validateCharacter(character, { requireComplete: true }); }

export function createRoster() { return { schemaVersion: ROSTER_SCHEMA_VERSION, activeCharacterId: null, characters: [] }; }

export function migrateRoster(value) {
  if (!value || typeof value !== "object") throw new Error("Roster must be an object.");
  // Version zero was the earliest local prototype: an array of characters.
  const source = Array.isArray(value) ? { schemaVersion: 0, characters: value } : value;
  if (![0, ROSTER_SCHEMA_VERSION].includes(source.schemaVersion)) throw new Error(`Unsupported roster schema version: ${source.schemaVersion}.`);
  const characters = array(source.characters).map(migrateCharacter);
  if (!unique(characters.map((character) => character.id))) throw new Error("Roster has duplicate character ids.");
  const activeCharacterId = characters.some((character) => character.id === source.activeCharacterId) ? source.activeCharacterId : (characters[0]?.id ?? null);
  return { schemaVersion: ROSTER_SCHEMA_VERSION, activeCharacterId, characters };
}

export function validateRoster(roster) {
  try { migrateRoster(roster); return []; } catch (error) { return [error.message]; }
}

export function exportCharacter(character) {
  const normalized = migrateCharacter(character);
  return JSON.stringify({ kind: CHARACTER_EXPORT_KIND, schemaVersion: CHARACTER_SCHEMA_VERSION, exportedAt: now(), character: normalized }, null, 2);
}

export function parseCharacterImport(json) {
  let value;
  try { value = JSON.parse(json); } catch { throw new Error("Import file is not valid JSON."); }
  if (!value || value.kind !== CHARACTER_EXPORT_KIND) throw new Error("Import file is not an Age of Rebellion companion character.");
  if (![1, CHARACTER_SCHEMA_VERSION].includes(value.schemaVersion)) throw new Error(`Unsupported import schema version: ${value?.schemaVersion}.`);
  return migrateCharacter(value.character);
}

export function touch(character) { return { ...character, updatedAt: now() }; }
