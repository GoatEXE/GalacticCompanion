import talentData from "./talents.json" with { type: "json" };

export const CORE_TALENT_COUNT = 182;
export const TALENT_ACTIVATIONS = Object.freeze([
  "passive",
  "action",
  "maneuver",
  "incidental",
  "incidental-out-of-turn"
]);

export const TALENTS = Object.freeze(talentData);

const ACTIVATION_VALUES = new Set(TALENT_ACTIVATIONS);
const SOURCE_URL_PREFIX = "https://online.anyflip.com/ziisf/jobq/mobile/index.html#page=";

export function validateTalentCatalog(talents = TALENTS) {
  const errors = [];
  if (!Array.isArray(talents)) return ["Talent catalogue must be an array."];
  if (talents.length !== CORE_TALENT_COUNT) {
    errors.push(`Core talent catalogue must contain ${CORE_TALENT_COUNT} entries.`);
  }

  const ids = new Set();
  const names = new Set();
  talents.forEach((talent, index) => {
    const label = `Talent at index ${index}`;
    if (!talent || typeof talent !== "object" || Array.isArray(talent)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    for (const field of ["id", "name", "description", "source", "sourceUrl"]) {
      if (typeof talent[field] !== "string" || talent[field].trim() === "") {
        errors.push(`${label} must include a non-empty ${field}.`);
      }
    }
    if (!ACTIVATION_VALUES.has(talent.activation)) {
      errors.push(`${label} has an unsupported activation.`);
    }
    for (const field of ["ranked", "npcOnly", "forceTalent"]) {
      if (typeof talent[field] !== "boolean") errors.push(`${label} must include boolean ${field}.`);
    }
    if (!Number.isInteger(talent.sourcePage) || talent.sourcePage < 142 || talent.sourcePage > 159) {
      errors.push(`${label} must cite a printed Core Rulebook page from 142 through 159.`);
    }
    if (typeof talent.source === "string" && Number.isInteger(talent.sourcePage) && talent.source !== `Age of Rebellion Core Rulebook, p. ${talent.sourcePage}`) {
      errors.push(`${label} has an invalid printed-source citation.`);
    }
    if (typeof talent.sourceUrl === "string" && Number.isInteger(talent.sourcePage) && talent.sourceUrl !== `${SOURCE_URL_PREFIX}${talent.sourcePage + 1}`) {
      errors.push(`${label} has an invalid direct-source URL.`);
    }
    if (typeof talent.id === "string") {
      if (ids.has(talent.id)) errors.push(`Duplicate talent id: ${talent.id}.`);
      ids.add(talent.id);
    }
    if (typeof talent.name === "string") {
      if (names.has(talent.name)) errors.push(`Duplicate talent name: ${talent.name}.`);
      names.add(talent.name);
    }
  });
  return errors;
}

export function findTalent(id) {
  return TALENTS.find((talent) => talent.id === id) ?? null;
}
