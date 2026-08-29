import { CHARACTERISTICS, SKILLS, findAnySpecialization, findCareer, findGear, findSpecialization, findSpecies, speciesGrantedSkillIds } from "./catalog.js";
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

export function ownedSpecializationIds(character) {
  const starting = findSpecialization(character.careerId, character.specializationId);
  return [starting?.globalId ?? character.specializationId, ...(Array.isArray(character.additionalSpecializationIds) ? character.additionalSpecializationIds : [])].filter(Boolean);
}

export function isCareerSpecialization(character, specializationId) {
  const specialization = findAnySpecialization(specializationId);
  return Boolean(specialization && (specialization.universal || specialization.careerId === character.careerId));
}

export function specializationCost(character, specializationId, ownedCount = ownedSpecializationIds(character).length) {
  if (!findAnySpecialization(specializationId)) return 0;
  return (ownedCount + 1) * 10 + (isCareerSpecialization(character, specializationId) ? 0 : 10);
}

export function additionalSpecializationCosts(character) {
  let ownedCount = character.specializationId ? 1 : 0;
  return (Array.isArray(character.additionalSpecializationIds) ? character.additionalSpecializationIds : []).map((id) => {
    const cost = specializationCost(character, id, ownedCount);
    ownedCount += 1;
    return { id, cost };
  });
}

export function additionalSpecializationCost(character, specializationId) {
  return specializationCost(character, specializationId, ownedSpecializationIds(character).length);
}

export function isCareerSkill(character, skillId) {
  const career = findCareer(character.careerId);
  const specializationIds = ownedSpecializationIds(character);
  return Boolean(skillId && (career?.skillIds.includes(skillId) || specializationIds.some((id) => findAnySpecialization(id)?.skillIds.includes(skillId))));
}

function isStartingCareerSkill(character, skillId) {
  const career = findCareer(character.careerId);
  const specialization = findSpecialization(character.careerId, character.specializationId);
  return Boolean(career?.skillIds.includes(skillId) || specialization?.skillIds.includes(skillId));
}

export function purchasedSkillCostEntries(character, skillId) {
  const count = character.purchasedSkillRanks?.[skillId] ?? 0;
  const recorded = character.purchasedSkillCosts?.[skillId];
  if (Array.isArray(recorded) && recorded.length === count && recorded.every((entry) => entry && typeof entry === "object" && Number.isFinite(entry.cost) && typeof entry.career === "boolean")) return recorded;
  const ranks = selectedSkillRanks({ ...character, purchasedSkillRanks: {}, purchasedSkillCosts: {} });
  const career = isStartingCareerSkill(character, skillId);
  return Array.from({ length: count }, (_, index) => ({ cost: skillRankCost({ currentRank: ranks[skillId] + index, career }), career }));
}

export function purchasedSkillCost(character, skillId) {
  return purchasedSkillCostEntries(character, skillId).reduce((sum, entry) => sum + entry.cost, 0);
}

export function additionalSpecializationUndoBlockReason(character) {
  const additionalIds = Array.isArray(character.additionalSpecializationIds) ? character.additionalSpecializationIds : [];
  if (!additionalIds.length) return "";
  const afterUndo = { ...character, additionalSpecializationIds: additionalIds.slice(0, -1) };
  for (const skill of SKILLS) {
    if (isCareerSkill(afterUndo, skill.id) || !isCareerSkill(character, skill.id)) continue;
    if (purchasedSkillCostEntries(character, skill.id).some((entry) => entry.career === true)) return `Undo unavailable: Remove purchased ${skill.name} ranks before undoing this specialization.`;
  }
  return "";
}

export function xpSpent(character) {
  const characteristics = CHARACTERISTICS.reduce((sum, key) => sum + characteristicCost(character, key), 0);
  const skills = SKILLS.reduce((sum, skill) => sum + purchasedSkillCost(character, skill.id), 0);
  const specializations = additionalSpecializationCosts(character).reduce((sum, entry) => sum + entry.cost, 0);
  return characteristics + skills + specializations;
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
