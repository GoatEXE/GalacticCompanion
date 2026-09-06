import test from "node:test";
import assert from "node:assert/strict";
import {
  CORE_TALENT_COUNT,
  TALENT_ACTIVATIONS,
  TALENTS,
  findTalent,
  validateTalentCatalog
} from "../src/companion/talents.js";

const EXPECTED_CORE_TALENT_NAMES = [
  "Adversary", "All-Terrain Driver", "Anatomy Lessons", "Armor Master", "Armor Master (Improved)",
  "Bacta Specialist", "Bad Motivator", "Balance", "Basic Combat Training", "Blooded", "Body Guard",
  "Bought Info", "Brace", "Brilliant Evasion", "Bypass Security", "Careful Planning", "Clever Solution",
  "Codebreaker", "Command", "Commanding Presence", "Confidence", "Contraption", "Convincing Demeanor",
  "Coordinated Assault", "Creative Killer", "Crippling Blow", "Dead to Rights", "Dead to Rights (Improved)",
  "Deadly Accuracy", "Debilitating Shot", "Dedication", "Defensive Driving", "Defensive Slicing",
  "Defensive Slicing (Improved)", "Defensive Stance", "Disorient", "Dodge", "Durable", "Dynamic Fire",
  "Enduring", "Exhaust Port", "Expert Tracker", "Familiar Suns", "Feral Strength", "Field Commander",
  "Field Commander (Improved)", "Fine Tuning", "Fire Control", "Forager", "Force of Will", "Force Rating",
  "Form on Me", "Frenzied Attack", "Full Stop", "Full Throttle", "Full Throttle (Improved)",
  "Full Throttle (Supreme)", "Galaxy Mapper", "Gearhead", "Greased Palms", "Grit", "Hard Headed",
  "Hard Headed (Improved)", "Heightened Awareness", "Heroic Fortitude", "Hidden Storage", "Hold Together",
  "Incite Rebellion", "Indistinguishable", "Insight", "Inspiring Rhetoric", "Inspiring Rhetoric (Improved)",
  "Inspiring Rhetoric (Supreme)", "Intense Focus", "Intense Presence", "Intimidating", "Inventor", "Invigorate",
  "It's Not That Bad", "Jump Up", "Jury Rigged", "Kill with Kindness", "Knockdown", "Know Somebody",
  "Knowledge Specialization", "Known Schematic", "Let's Ride", "Lethal Blows", "Master Doctor", "Master Driver",
  "Master Grenadier", "Master Leader", "Master Merchant", "Master of Shadows", "Master Pilot", "Master Slicer",
  "Master Starhopper", "Mental Fortress", "Natural Brawler", "Natural Charmer", "Natural Doctor", "Natural Driver",
  "Natural Enforcer", "Natural Hunter", "Natural Leader", "Natural Marksman", "Natural Negotiator",
  "Natural Outdoorsman", "Natural Pilot", "Natural Programmer", "Natural Rogue", "Natural Scholar",
  "Natural Tinkerer", "Nobody's Fool", "Outdoorsman", "Overwhelm Defenses", "Physical Training",
  "Plausible Deniability", "Point Blank", "Powerful Blast", "Quick Draw", "Quick Fix", "Quick Strike",
  "Rapid Reaction", "Rapid Recovery", "Redundant Systems", "Researcher", "Resolve", "Respected Scholar",
  "Scathing Tirade", "Scathing Tirade (Improved)", "Scathing Tirade (Supreme)", "Second Wind",
  "Selective Detonation", "Sense Danger", "Shortcut", "Side Step", "Situational Awareness", "Sixth Sense",
  "Skilled Jockey", "Skilled Slicer", "Sleight of Mind", "Smooth Talker", "Sniper Shot", "Soft Spot",
  "Solid Repairs", "Sound Investments", "Spare Clip", "Speaks Binary", "Stalker", "Steely Nerves",
  "Stim Application", "Stim Application (Improved)", "Stim Application (Supreme)", "Stimpack Specialization",
  "Street Smarts", "Stroke of Genius", "Strong Arm", "Stunning Blow", "Stunning Blow (Improved)",
  "Superior Reflexes", "Surgeon", "Swift", "Tactical Combat Training", "Targeted Blow", "Technical Aptitude",
  "Time to Go", "Time to Go (Improved)", "Tinkerer", "Touch of Fate", "Toughened", "Tricky Target",
  "True Aim", "Uncanny Reactions", "Uncanny Senses", "Unstoppable", "Utility Belt", "Vehicle Combat Training",
  "Well Rounded", "Well Traveled", "Wheel and Deal", "Works Like a Charm"
];

const EXPECTED_PAGE_COUNTS = new Map([
  [142, 4], [143, 9], [144, 9], [145, 12], [146, 12], [147, 9], [148, 11], [149, 7],
  [150, 12], [151, 13], [153, 16], [154, 13], [155, 9], [156, 11], [157, 14], [158, 14], [159, 7]
]);

test("Core talent catalogue contains every accepted Core entry exactly once", () => {
  assert.equal(CORE_TALENT_COUNT, 182);
  assert.equal(TALENTS.length, CORE_TALENT_COUNT);
  assert.equal(EXPECTED_CORE_TALENT_NAMES.length, CORE_TALENT_COUNT);
  assert.deepEqual([...TALENTS.map((talent) => talent.name)].sort(), [...EXPECTED_CORE_TALENT_NAMES].sort());
  assert.equal(new Set(TALENTS.map((talent) => talent.id)).size, CORE_TALENT_COUNT);
  assert.equal(new Set(TALENTS.map((talent) => talent.name)).size, CORE_TALENT_COUNT);
  assert.equal(findTalent("fine-tuning")?.name, "Fine Tuning");
  assert.equal(findTalent("not-a-core-talent"), null);
});

test("Core talent entries have valid types, normalized activations, descriptions, citations, and flags", () => {
  assert.deepEqual(validateTalentCatalog(), []);
  assert.deepEqual(new Map([...TALENTS.reduce((counts, talent) => counts.set(talent.sourcePage, (counts.get(talent.sourcePage) ?? 0) + 1), new Map())].sort()), EXPECTED_PAGE_COUNTS);
  for (const talent of TALENTS) {
    assert.ok(TALENT_ACTIVATIONS.includes(talent.activation));
    assert.ok(talent.description.length > 0);
    assert.equal(talent.source, `Age of Rebellion Core Rulebook, p. ${talent.sourcePage}`);
    assert.equal(talent.sourceUrl, `https://online.anyflip.com/ziisf/jobq/mobile/index.html#page=${talent.sourcePage + 1}`);
    assert.equal(typeof talent.ranked, "boolean");
    assert.equal(typeof talent.npcOnly, "boolean");
    assert.equal(typeof talent.forceTalent, "boolean");
  }
});

test("Core talent flags preserve NPC-only and printed Force-talent designations", () => {
  assert.deepEqual(TALENTS.filter((talent) => talent.npcOnly).map((talent) => talent.name), ["Adversary"]);
  assert.deepEqual(TALENTS.filter((talent) => talent.forceTalent).map((talent) => talent.name), [
    "Balance", "Force Rating", "Insight", "Invigorate", "Sense Danger", "Sleight of Mind", "Touch of Fate",
    "Uncanny Reactions", "Uncanny Senses"
  ]);
});

test("talent validation rejects missing fields, invalid values, duplicate identities, and incomplete coverage", () => {
  const malformed = TALENTS.map((talent) => ({ ...talent }));
  malformed[0] = {
    ...malformed[0],
    description: "",
    source: "",
    sourceUrl: "",
    sourcePage: null,
    activation: "reaction",
    ranked: "yes",
    npcOnly: null,
    forceTalent: null
  };
  malformed[1] = { ...malformed[1], id: malformed[0].id, name: malformed[0].name };
  const errors = validateTalentCatalog(malformed.slice(0, -1));
  assert.ok(errors.includes("Core talent catalogue must contain 182 entries."));
  assert.ok(errors.some((error) => error.includes("non-empty description")));
  assert.ok(errors.some((error) => error.includes("non-empty source")));
  assert.ok(errors.some((error) => error.includes("unsupported activation")));
  assert.ok(errors.some((error) => error.includes("boolean ranked")));
  assert.ok(errors.some((error) => error.includes("boolean npcOnly")));
  assert.ok(errors.some((error) => error.includes("boolean forceTalent")));
  assert.ok(errors.some((error) => error.includes("printed Core Rulebook page")));
  assert.ok(errors.includes("Duplicate talent id: adversary."));
  assert.ok(errors.includes("Duplicate talent name: Adversary."));
});
