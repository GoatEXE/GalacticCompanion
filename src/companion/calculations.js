import { CHARACTERISTICS, SKILLS, findCareer, findGear, findSpecialization, findSpecies, speciesGrantedSkillIds } from "./catalog.js";
import { getCharacterCompletionErrors } from "./schema.js";

const characteristicLabels = Object.fromEntries(CHARACTERISTICS.map((key) => [key, key[0].toUpperCase() + key.slice(1)]));

export { characteristicLabels };

export function selectedSkillRanks(character) {
  const ranks = Object.fromEntries(SKILLS.map((skill) => [skill.id, 0]));
  const species = findSpecies(character.speciesId);
  [
    character.careerTraining,
    character.specializationTraining,
    character.humanBonusTraining,
    speciesGrantedSkillIds(species, character.speciesTraining)
  ].flat().forEach((skillId) => {
    if (skillId in ranks) ranks[skillId] += 1;
  });
  Object.entries(character.purchasedSkillRanks ?? {}).forEach(([skillId, amount]) => {
    if (skillId in ranks) ranks[skillId] += amount;
  });
  return ranks;
}

export function getCharacteristicValues(character) {
  const species = findSpecies(character.speciesId);
  return Object.fromEntries(CHARACTERISTICS.map((key) => [key, (species?.characteristics[key] ?? 0) + (character.characteristicAdvances?.[key] ?? 0)]));
}

export function characteristicCost(character, key) {
  const species = findSpecies(character.speciesId);
  if (!species || !CHARACTERISTICS.includes(key)) return 0;
  const advances = character.characteristicAdvances?.[key] ?? 0;
  return Array.from({ length: advances }, (_, index) => 10 * (species.characteristics[key] + index + 1)).reduce((sum, cost) => sum + cost, 0);
}

export function skillRankCost({ currentRank, career }) {
  return (5 * (currentRank + 1)) + (career ? 0 : 5);
}

export function isCareerSkill(character, skillId) {
  const career = findCareer(character.careerId);
  const specialization = findSpecialization(character.careerId, character.specializationId);
  return Boolean(skillId && (career?.skillIds.includes(skillId) || specialization?.skillIds.includes(skillId)));
}

export function purchasedSkillCost(character, skillId) {
  const ranks = selectedSkillRanks({ ...character, purchasedSkillRanks: {} });
  const count = character.purchasedSkillRanks?.[skillId] ?? 0;
  return Array.from({ length: count }, (_, index) => skillRankCost({ currentRank: ranks[skillId] + index, career: isCareerSkill(character, skillId) }))
    .reduce((sum, cost) => sum + cost, 0);
}

export function xpSpent(character) {
  const characteristics = CHARACTERISTICS.reduce((sum, key) => sum + characteristicCost(character, key), 0);
  const skills = SKILLS.reduce((sum, skill) => sum + purchasedSkillCost(character, skill.id), 0);
  return characteristics + skills;
}

export function xpBudget(character) {
  return (findSpecies(character.speciesId)?.startingXp ?? 0) + (character.dutyXpExchange ? 5 : 0);
}

export function creditSpent(character) {
  return (character.gearIds ?? []).reduce((sum, gearId) => sum + (findGear(gearId)?.cost ?? 0), 0);
}

export function creditBudget(character) { return 500 + (character.dutyCreditExchange ? 1000 : 0); }

export function dutyRemaining(character) {
  return Math.max(0, (character.startingDuty ?? 0) - (character.dutyXpExchange ? 5 : 0) - (character.dutyCreditExchange ? 5 : 0));
}

export function deriveCharacter(character) {
  const species = findSpecies(character.speciesId);
  const characteristics = getCharacteristicValues(character);
  const skillRanks = selectedSkillRanks(character);
  const gear = (character.gearIds ?? []).map(findGear).filter(Boolean);
  const woundThreshold = species ? species.woundBase + characteristics.brawn : 0;
  const strainThreshold = species ? species.strainBase + characteristics.willpower : 0;
  const errors = getCharacterCompletionErrors(character);
  if (Object.values(characteristics).some((value) => value > 5)) errors.push("Characteristics cannot exceed 5 during character creation.");
  if (Object.values(skillRanks).some((value) => value > 2)) errors.push("Skills cannot exceed rank 2 during character creation.");
  if (xpSpent(character) > xpBudget(character)) errors.push("XP spending exceeds the available budget.");
  if (creditSpent(character) > creditBudget(character)) errors.push("Gear cost exceeds available credits.");
  return {
    species, characteristics, skillRanks, gear, woundThreshold, strainThreshold,
    xp: { budget: xpBudget(character), spent: xpSpent(character), remaining: xpBudget(character) - xpSpent(character) },
    credits: { budget: creditBudget(character), spent: creditSpent(character), remaining: creditBudget(character) - creditSpent(character) },
    dutyRemaining: dutyRemaining(character), errors, isPlayable: errors.length === 0
  };
}

/** Starting pool for a skill check: characteristic dice upgraded by trained ranks. */
export function createSkillPool(characteristic, rank, difficulty = 2) {
  const safeCharacteristic = Math.max(0, Math.trunc(Number(characteristic) || 0));
  const safeRank = Math.max(0, Math.trunc(Number(rank) || 0));
  return {
    proficiency: Math.min(safeCharacteristic, safeRank),
    ability: Math.max(safeCharacteristic, safeRank) - Math.min(safeCharacteristic, safeRank),
    boost: 0,
    challenge: 0,
    difficulty: Math.max(0, Math.trunc(Number(difficulty) || 0)),
    setback: 0
  };
}

export function skillPoolFor(character, skillId, difficulty = 2) {
  const skill = SKILLS.find((entry) => entry.id === skillId);
  const derived = deriveCharacter(character);
  return createSkillPool(derived.characteristics[skill?.characteristic] ?? 0, derived.skillRanks[skillId] ?? 0, difficulty);
}

export function clampTracker(value, threshold) {
  return Math.max(0, Math.min(Math.max(0, threshold), Math.trunc(Number(value) || 0)));
}
