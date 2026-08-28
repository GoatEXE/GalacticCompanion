/**
 * Compact, source-backed Core Rulebook catalogue.
 * This MVP intentionally records compact names, descriptions, skill metadata,
 * and citations; it does not reproduce talent trees, connector diagrams, or
 * talent effects.
 */
export const CATALOG_VERSION = 2;
export const CATALOG_SOURCES = {
  characterCreation: "Age of Rebellion Core Rulebook, Chapter II (pp. 39–111)",
  species: "Age of Rebellion Core Rulebook, species chapter (pp. 51–60)",
  careers: "Age of Rebellion Core Rulebook, careers (pp. 64–101)",
  gear: "Age of Rebellion Core Rulebook, gear chapter; compact starter selection"
};

export const CHARACTERISTICS = ["brawn", "agility", "intellect", "cunning", "willpower", "presence"];

export const SKILLS = [
  ["Astrogation", "intellect"], ["Athletics", "brawn"], ["Brawl", "brawn"], ["Charm", "presence"],
  ["Coercion", "willpower"], ["Computers", "intellect"], ["Cool", "cunning"], ["Coordination", "agility"],
  ["Deception", "cunning"], ["Discipline", "willpower"], ["Gunnery", "agility"], ["Leadership", "presence"],
  ["Mechanics", "intellect"], ["Medicine", "intellect"], ["Melee", "brawn"], ["Negotiation", "presence"],
  ["Perception", "cunning"], ["Piloting (Planetary)", "agility"], ["Piloting (Space)", "agility"],
  ["Ranged (Heavy)", "agility"], ["Ranged (Light)", "agility"], ["Resilience", "brawn"],
  ["Skulduggery", "agility"], ["Stealth", "agility"], ["Streetwise", "cunning"], ["Survival", "cunning"],
  ["Vigilance", "willpower"], ["Knowledge (Core Worlds)", "intellect"], ["Knowledge (Education)", "intellect"],
  ["Knowledge (Lore)", "intellect"], ["Knowledge (Outer Rim)", "intellect"], ["Knowledge (Underworld)", "intellect"],
  ["Knowledge (Warfare)", "intellect"], ["Knowledge (Xenology)", "intellect"]
].map(([name, characteristic]) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, characteristic }));

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]));
const skillId = (name) => SKILLS.find((skill) => skill.name === name)?.id;
const skillIds = (names) => names.map((name) => {
  const id = skillId(name);
  if (!id) throw new Error(`Unknown Core Rulebook skill: ${name}`);
  return id;
});

export const BACKGROUNDS = [
  "Alliance recruit", "Displaced civilian", "Former Imperial", "Outer Rim native", "Independent spacer", "Local resistance"
].map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name }));

const DUTY_SOURCE = "Age of Rebellion Core Rulebook, p. 47";
const DUTY_SOURCE_URL = "https://online.anyflip.com/ziisf/jobq/mobile/index.html#page=48";

export const DUTIES = [
  ["Combat Victory", "Prove the Alliance can win ground engagements by seeking victories, bold raids, sound tactics, and stronger firepower."],
  ["Counter-intelligence", "Protect the Alliance from Imperial scrutiny by finding enemy agents, spreading false information, and concealing Rebel movements."],
  ["Intelligence", "Gather useful information about Imperial forces, research, policy, and other weaknesses so the Alliance can choose valuable targets."],
  ["Internal Security", "Protect the Alliance from threats within its own ranks and stay alert for betrayal that could endanger an operation."],
  ["Personnel", "Look after Rebel people, their safety, and their ability to succeed; a mission still matters when its people come home alive."],
  ["Political Support", "Build the political will for rebellion by bringing more factions, systems, and sectors to the Alliance and its cause."],
  ["Recruiting", "Find capable, trustworthy allies to fill the many roles the Rebellion needs, from soldiers and pilots to technicians and medics."],
  ["Resource Acquisition", "Secure the supplies, materials, weapons, and equipment Rebel operations need, using whatever legitimate means are available."],
  ["Sabotage", "Disrupt Imperial operations and deny key assets so the Empire moves more slowly and acts less effectively."],
  ["Space Superiority", "Help the Alliance prevail in ship-to-ship war by advancing its pilots and proving Rebel forces can win in the stars."],
  ["Tech Procurement", "Use scientific and technical expertise to improve equipment, develop useful solutions, and acquire advances from the Empire."],
  ["Support", "Help fellow Rebels fulfill their Duties by providing the assistance they need, creating more chances to advance the cause together."]
].map(([name, description]) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, description,
  source: DUTY_SOURCE, sourceUrl: DUTY_SOURCE_URL
}));

const species = [
  ["human", "Human", 110, [2, 2, 2, 2, 2, 2], 10, 10, { kind: "human" }, "p. 56"],
  ["bothan", "Bothan", 100, [1, 2, 2, 3, 2, 2], 10, 11, { kind: "none", startingSkillIds: ["streetwise"] }, "p. 51"],
  ["droid", "Droid", 175, [1, 1, 2, 1, 1, 1], 10, 10, { kind: "droid" }, "pp. 52–53"],
  ["duros", "Duros", 110, [1, 2, 2, 2, 2, 2], 10, 10, { kind: "none", startingSkillIds: ["piloting-space"] }, "p. 54"],
  ["gran", "Gran", 100, [2, 1, 2, 2, 2, 3], 10, 11, { kind: "none", startingSkillChoice: { count: 1, skillIds: ["charm", "negotiation"] } }, "p. 55"],
  ["ithorian", "Ithorian", 100, [3, 1, 2, 2, 2, 2], 12, 9, { kind: "none", startingSkillIds: ["survival"] }, "p. 57"],
  ["mon-calamari", "Mon Calamari", 100, [1, 2, 3, 2, 2, 2], 10, 10, { kind: "none", startingSkillIds: ["knowledge-education"] }, "pp. 58–59"],
  ["sullustan", "Sullustan", 100, [1, 3, 2, 2, 2, 2], 10, 11, { kind: "none", startingSkillIds: ["astrogation"] }, "p. 60"]
];

export const SPECIES = species.map(([id, name, startingXp, values, woundBase, strainBase, setup, page]) => ({
  id, name, startingXp, woundBase, strainBase, setup,
  source: `Age of Rebellion Core Rulebook, ${page}`,
  characteristics: Object.fromEntries(CHARACTERISTICS.map((key, index) => [key, values[index]]))
}));

const careers = [
  ["ace", "Ace", ["Astrogation", "Cool", "Gunnery", "Mechanics", "Perception", "Piloting (Planetary)", "Piloting (Space)", "Ranged (Light)"], [
    ["driver", "Driver", ["Cool", "Gunnery", "Mechanics", "Piloting (Planetary)"], "p. 65"],
    ["gunner", "Gunner", ["Discipline", "Gunnery", "Ranged (Heavy)", "Resilience"], "p. 66"],
    ["pilot", "Pilot", ["Astrogation", "Gunnery", "Piloting (Planetary)", "Piloting (Space)"], "p. 67"]
  ], "p. 64"],
  ["commander", "Commander", ["Coercion", "Cool", "Discipline", "Knowledge (Warfare)", "Leadership", "Perception", "Ranged (Light)", "Vigilance"], [
    ["commodore", "Commodore", ["Astrogation", "Computers", "Knowledge (Education)", "Knowledge (Outer Rim)"], "p. 71"],
    ["squadron-leader", "Squadron Leader", ["Gunnery", "Mechanics", "Piloting (Planetary)", "Piloting (Space)"], "p. 72"],
    ["tactician", "Tactician", ["Brawl", "Discipline", "Leadership", "Ranged (Heavy)"], "p. 73"]
  ], "p. 70"],
  ["diplomat", "Diplomat", ["Charm", "Deception", "Knowledge (Core Worlds)", "Knowledge (Lore)", "Knowledge (Outer Rim)", "Knowledge (Xenology)", "Leadership", "Negotiation"], [
    ["ambassador", "Ambassador", ["Charm", "Discipline", "Knowledge (Core Worlds)", "Negotiation"], "p. 79"],
    ["agitator", "Agitator", ["Coercion", "Deception", "Knowledge (Underworld)", "Streetwise"], "p. 80"],
    ["quartermaster", "Quartermaster", ["Computers", "Negotiation", "Skulduggery", "Vigilance"], "p. 81"]
  ], "p. 77"],
  ["engineer", "Engineer", ["Athletics", "Computers", "Knowledge (Education)", "Mechanics", "Perception", "Piloting (Space)", "Ranged (Light)", "Vigilance"], [
    ["mechanic", "Mechanic", ["Brawl", "Mechanics", "Piloting (Space)", "Skulduggery"], "p. 83"],
    ["saboteur", "Saboteur", ["Coordination", "Mechanics", "Skulduggery", "Stealth"], "p. 84"],
    ["scientist", "Scientist", ["Computers", "Knowledge (Education)", "Knowledge (Lore)", "Medicine"], "p. 85"]
  ], "p. 82"],
  ["soldier", "Soldier", ["Athletics", "Brawl", "Knowledge (Warfare)", "Medicine", "Melee", "Ranged (Light)", "Ranged (Heavy)", "Survival"], [
    ["commando", "Commando", ["Brawl", "Melee", "Resilience", "Survival"], "p. 89"],
    ["medic", "Medic", ["Knowledge (Xenology)", "Medicine", "Resilience", "Vigilance"], "p. 90"],
    ["sharpshooter", "Sharpshooter", ["Cool", "Perception", "Ranged (Heavy)", "Ranged (Light)"], "p. 91"]
  ], "p. 88"],
  ["spy", "Spy", ["Computers", "Cool", "Coordination", "Deception", "Knowledge (Warfare)", "Perception", "Skulduggery", "Stealth"], [
    ["infiltrator", "Infiltrator", ["Deception", "Melee", "Skulduggery", "Streetwise"], "p. 95"],
    ["scout", "Scout", ["Athletics", "Medicine", "Piloting (Planetary)", "Survival"], "p. 96"],
    ["slicer", "Slicer", ["Computers", "Knowledge (Education)", "Knowledge (Underworld)", "Stealth"], "p. 97"]
  ], "p. 94"]
];

export const CAREERS = careers.map(([id, name, names, specializations, page]) => ({
  id, name, skillIds: skillIds(names), source: `Age of Rebellion Core Rulebook, ${page}`,
  specializations: specializations.map(([specializationId, specializationName, specializationSkills, specializationPage]) => ({
    id: specializationId,
    name: specializationName,
    skillIds: skillIds(specializationSkills),
    source: `Age of Rebellion Core Rulebook, ${specializationPage}`
  }))
}));

export const GEAR = [
  ["comlink", "Comlink", 25, 1], ["stimpack", "Stimpack", 25, 0], ["utility-belt", "Utility belt", 25, 1],
  ["combat-knife", "Combat knife", 25, 1, "Melee", "brawn", 1, 3, "Engaged"],
  ["heavy-clothing", "Heavy clothing", 50, 1],
  ["blaster-pistol", "Blaster pistol", 400, 1, "Ranged (Light)", "agility", 6, 3, "Medium"],
  ["padded-armor", "Padded armor", 500, 2],
  ["blaster-rifle", "Blaster rifle", 900, 4, "Ranged (Heavy)", "agility", 9, 3, "Long"]
].map(([id, name, cost, encumbrance, skill, characteristic, damage, critical, range]) => ({ id, name, cost, encumbrance, skill, characteristic, damage, critical, range }));

export const CATALOG = { version: CATALOG_VERSION, sources: CATALOG_SOURCES, species: SPECIES, careers: CAREERS, gear: GEAR };

export function speciesGrantedSkillIds(entry, selectedChoices = []) {
  if (!entry) return [];
  const fixed = entry.setup?.startingSkillIds ?? [];
  const choice = entry.setup?.startingSkillChoice;
  const selected = choice ? selectedChoices.filter((id) => choice.skillIds.includes(id)).slice(0, choice.count) : [];
  return [...fixed, ...selected];
}

export function validateCatalog(catalog = CATALOG) {
  const errors = [];
  const idsAreUnique = (entries) => new Set(entries.map((entry) => entry.id)).size === entries.length;
  const validSkill = (id) => SKILLS.some((skill) => skill.id === id);
  if (catalog.version !== CATALOG_VERSION) errors.push("Unsupported catalogue version.");
  if (!catalog.sources?.characterCreation) errors.push("Catalogue must identify its character-creation source.");
  if (!Array.isArray(catalog.species) || catalog.species.length !== 8 || !idsAreUnique(catalog.species)) errors.push("Core catalogue must contain eight unique species.");
  if (!Array.isArray(catalog.careers) || catalog.careers.length !== 6 || !idsAreUnique(catalog.careers)) errors.push("Core catalogue must contain six unique careers.");
  if (!Array.isArray(catalog.gear) || !idsAreUnique(catalog.gear)) errors.push("Gear ids must be unique.");
  catalog.species?.forEach((entry) => {
    const fixed = entry.setup?.startingSkillIds ?? [];
    const choice = entry.setup?.startingSkillChoice;
    if (!Number.isInteger(entry.startingXp) || entry.startingXp <= 0 || CHARACTERISTICS.some((key) => !Number.isInteger(entry.characteristics?.[key])) || !entry.source || !fixed.every(validSkill) || (choice && (!Number.isInteger(choice.count) || choice.count < 1 || !choice.skillIds?.every(validSkill)))) errors.push(`Invalid species: ${entry.id}.`);
  });
  catalog.careers?.forEach((career) => {
    if (!career.source || career.skillIds?.length !== 8 || !career.skillIds?.every(validSkill)) errors.push(`Invalid career skill in ${career.id}.`);
    if (career.specializations?.length !== 3 || !idsAreUnique(career.specializations ?? []) || !career.specializations?.every((specialization) => specialization.source && specialization.skillIds.length === 4 && specialization.skillIds.every(validSkill))) errors.push(`Invalid specialization in ${career.id}.`);
  });
  return errors;
}

export function findSpecies(id) { return SPECIES.find((entry) => entry.id === id) ?? null; }
export function findCareer(id) { return CAREERS.find((entry) => entry.id === id) ?? null; }
export function findSpecialization(careerId, specializationId) { return findCareer(careerId)?.specializations.find((entry) => entry.id === specializationId) ?? null; }
export function findGear(id) { return GEAR.find((entry) => entry.id === id) ?? null; }
