import { findCareer, findSpecialization } from "./catalog.js";

/**
 * Root creation choices can invalidate both a talent tree and its XP snapshot.
 * Clear only a changed root's durable purchases; a same-value UI update remains
 * lossless.
 */
export function changeSpecies(character, speciesId) {
  if (character.speciesId === speciesId) return character;
  return {
    ...character,
    speciesId,
    speciesTraining: [],
    humanBonusTraining: speciesId === "human" ? character.humanBonusTraining : [],
    talentPurchases: []
  };
}

export function changeStartingCareer(character, careerId) {
  if (character.careerId === careerId) return character;
  const nextCareer = findCareer(careerId);
  const careerSkillIds = nextCareer?.skillIds ?? [];
  return {
    ...character,
    careerId,
    specializationId: "",
    additionalSpecializationIds: [],
    careerTraining: [],
    specializationTraining: [],
    purchasedSkillRanks: {},
    purchasedSkillCosts: {},
    humanBonusTraining: (character.humanBonusTraining ?? []).filter((id) => !careerSkillIds.includes(id)),
    talentPurchases: []
  };
}

export function changeStartingSpecialization(character, specializationId) {
  if (character.specializationId === specializationId) return character;
  const nextSpecialization = findSpecialization(character.careerId, specializationId);
  const specializationSkillIds = nextSpecialization?.skillIds ?? [];
  return {
    ...character,
    specializationId,
    additionalSpecializationIds: (character.additionalSpecializationIds ?? []).filter((id) => id !== nextSpecialization?.globalId && id !== nextSpecialization?.id),
    specializationTraining: [],
    purchasedSkillRanks: {},
    purchasedSkillCosts: {},
    humanBonusTraining: (character.humanBonusTraining ?? []).filter((id) => !specializationSkillIds.includes(id)),
    talentPurchases: []
  };
}
