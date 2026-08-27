export const DICE_TYPES = ["proficiency", "ability", "boost", "challenge", "difficulty", "setback"];
export const MIN_DICE = 0;
export const MAX_DICE = 10;

export const DICE_FACES = {
  boost: [{}, {}, { success: 1 }, { success: 1, advantage: 1 }, { advantage: 2 }, { advantage: 1 }],
  setback: [{}, {}, { failure: 1 }, { failure: 1 }, { threat: 1 }, { threat: 1 }],
  ability: [{}, { success: 1 }, { success: 1 }, { success: 2 }, { advantage: 1 }, { advantage: 1 }, { success: 1, advantage: 1 }, { advantage: 2 }],
  difficulty: [{}, { failure: 1 }, { failure: 2 }, { threat: 1 }, { threat: 1 }, { threat: 1 }, { threat: 2 }, { failure: 1, threat: 1 }],
  proficiency: [{}, { success: 1 }, { success: 1 }, { success: 2 }, { success: 2 }, { advantage: 1 }, { success: 1, advantage: 1 }, { success: 1, advantage: 1 }, { success: 1, advantage: 1 }, { advantage: 2 }, { advantage: 2 }, { triumph: 1 }],
  challenge: [{}, { failure: 1 }, { failure: 1 }, { failure: 2 }, { failure: 2 }, { threat: 1 }, { threat: 1 }, { failure: 1, threat: 1 }, { failure: 1, threat: 1 }, { threat: 2 }, { threat: 2 }, { despair: 1 }]
};

export function createEmptyTotals() {
  return { success: 0, advantage: 0, triumph: 0, despair: 0, failure: 0, threat: 0 };
}

export function createEmptyPool() {
  return Object.fromEntries(DICE_TYPES.map((type) => [type, 0]));
}

export function clampDiceCount(value) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return MIN_DICE;
  return Math.max(MIN_DICE, Math.min(MAX_DICE, Math.trunc(parsedValue)));
}

function addSymbols(totals, symbols) {
  Object.entries(symbols).forEach(([symbol, count]) => {
    totals[symbol] += count;
  });
}

export function simulateRoll(pool, random = Math.random) {
  const totals = createEmptyTotals();
  DICE_TYPES.forEach((type) => {
    const count = clampDiceCount(pool[type]);
    const faces = DICE_FACES[type];
    for (let index = 0; index < count; index += 1) {
      const face = faces[Math.floor(random() * faces.length)];
      addSymbols(totals, face);
    }
  });
  return totals;
}

/**
 * Applies Age of Rebellion cancellation rules without consuming special events:
 * Triumph supplies one Success and Despair supplies one Failure. The special
 * Triumph/Despair outcomes remain visible even when their Success/Failure
 * contribution cancels out.
 */
export function normalizeResults(results) {
  const normalizedResults = { ...createEmptyTotals(), ...results };
  const totalSuccess = normalizedResults.success + normalizedResults.triumph;
  const totalFailure = normalizedResults.failure + normalizedResults.despair;
  const netSuccess = Math.max(0, totalSuccess - totalFailure);
  const netFailure = Math.max(0, totalFailure - totalSuccess);

  normalizedResults.success = netSuccess;
  normalizedResults.failure = netFailure;

  const netAdvantage = normalizedResults.advantage - normalizedResults.threat;
  normalizedResults.advantage = Math.max(0, netAdvantage);
  normalizedResults.threat = Math.max(0, -netAdvantage);

  return { normalizedResults, netSuccess, netFailure };
}

export function createInterpretation({ netSuccess, netFailure, normalizedResults }) {
  const events = [];
  if (normalizedResults.triumph > 0) events.push("Triumph");
  if (normalizedResults.despair > 0) events.push("Despair");
  const eventsSuffix = events.length
    ? ` ${events.join(" and ")} event${events.length > 1 ? "s" : ""} triggered.`
    : "";

  if (netSuccess > netFailure) {
    return { tone: "success", message: `The action succeeds with ${netSuccess} net Success.${eventsSuffix}` };
  }
  return {
    tone: "failure",
    message: netFailure > 0
      ? `The action fails with ${netFailure} net Failure.${eventsSuffix}`
      : `The action fails with no net Success.${eventsSuffix}`
  };
}
