import { xpBudget, xpSpent } from "./calculations.js";
import { replayTalentPurchases, talentNodeEligibility } from "./talentCalculations.js";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function copyValue(value) {
  if (Array.isArray(value)) return value.map(copyValue);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyValue(entry)]));
  return value;
}

function normalizedLedger(character) {
  const ledger = character?.talentPurchases;
  if (ledger === undefined) return [];
  return ledger.map(({ nodeId, choices }) => ({ nodeId, choices: copyValue(choices) }));
}

function assertReplayIsValid(character) {
  const replay = replayTalentPurchases(character);
  if (!replay.valid) throw new Error(`Cannot change an invalid talent purchase ledger: ${replay.errors.map((error) => error.message).join(" ")}`);
  return replay;
}

/**
 * Appends one legal, affordable paid node occurrence. The durable record is
 * deliberately limited to its node ID and acquisition choices.
 */
export function purchaseTalentNode(character, nodeId, choices = {}) {
  if (typeof nodeId !== "string" || nodeId.trim() === "") throw new Error("Talent node id must be a non-empty string.");
  if (!isObject(choices)) throw new Error("Talent acquisition choices must be an object.");
  assertReplayIsValid(character);
  const eligibility = talentNodeEligibility(character, nodeId);
  if (!eligibility.rulesEligible) throw new Error(`Talent purchase is not legal: ${eligibility.reason}.`);
  if (!eligibility.affordable) throw new Error("Talent purchase exceeds the available XP budget.");

  const next = {
    ...character,
    talentPurchases: [...normalizedLedger(character), { nodeId, choices: copyValue(choices) }]
  };
  const replay = assertReplayIsValid(next);
  if (xpSpent(next) > xpBudget(next) || replay.xp.remaining < 0) throw new Error("Talent purchase exceeds the available XP budget.");
  return next;
}

/** Removes the newest paid node globally, regardless of its specialization. */
export function undoLastTalentPurchase(character) {
  assertReplayIsValid(character);
  const ledger = normalizedLedger(character);
  if (!ledger.length) throw new Error("There are no talent purchases to undo.");
  return { ...character, talentPurchases: ledger.slice(0, -1) };
}

// Compact aliases for callers that do not need the node-specific wording.
export const purchaseTalent = purchaseTalentNode;
export const undoTalentPurchase = undoLastTalentPurchase;
