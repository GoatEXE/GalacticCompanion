import test from "node:test";
import assert from "node:assert/strict";
import { xpSpent } from "../src/companion/calculations.js";
import { TALENTS } from "../src/companion/talents.js";
import {
  TALENT_NODE_REASONS,
  TALENT_NODE_STATUSES,
  deriveTalentState,
  nonTalentXpSpent,
  ownedTalentRanks,
  ownedTalentSpecializationIds,
  purchasableTalentNodes,
  replayTalentPurchases,
  talentNodeEligibility,
  talentXpSpent
} from "../src/companion/talentCalculations.js";

function purchase(nodeId, choices = {}) {
  return { nodeId, choices };
}

function purchases(...nodeIds) {
  return nodeIds.map((nodeId) => purchase(nodeId));
}

function purchaseNodeIds(character) {
  return character.talentPurchases.map((entry) => entry.nodeId);
}

function character(overrides = {}) {
  return {
    speciesId: "human",
    careerId: "soldier",
    specializationId: "commando",
    additionalSpecializationIds: [],
    talentPurchases: [],
    ...overrides
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

test("owned specialization IDs keep the starting tree first and canonicalize purchased trees", () => {
  const operative = character({
    careerId: "ace",
    specializationId: "driver",
    additionalSpecializationIds: ["universal:recruit", "soldier:commando", "universal:recruit"]
  });

  assert.deepEqual(ownedTalentSpecializationIds(operative), ["ace:driver", "universal:recruit", "soldier:commando"]);
  const state = deriveTalentState(operative);
  assert.equal(state.startingSpecializationGlobalId, "ace:driver");
  assert.deepEqual(state.additionalSpecializationGlobalIds, ["universal:recruit", "soldier:commando", "universal:recruit"]);
  assert.deepEqual(state.ownedSpecializationGlobalIds, ["ace:driver", "universal:recruit", "soldier:commando"]);
  assert.equal(state.treeSummaries.length, 3);
});

test("talentPurchases validates object record envelopes while keeping choices extensible", () => {
  const validNodeId = "soldier:commando:r1c1";
  const malformed = character({
    talentPurchases: [
      validNodeId,
      { nodeId: "soldier:commando:r1c2", choices: [] },
      { nodeId: "", choices: {} },
      { nodeId: validNodeId, choices: { futureChoice: { target: "ally", levels: [1, 2] } }, unknownFutureRecordField: true }
    ]
  });
  const replay = replayTalentPurchases(malformed);

  assert.equal(replay.valid, false);
  assert.deepEqual(replay.errors.map((error) => [error.purchaseIndex, error.code]), [
    [0, TALENT_NODE_REASONS.INVALID_PURCHASE_LEDGER],
    [1, TALENT_NODE_REASONS.INVALID_PURCHASE_LEDGER],
    [2, TALENT_NODE_REASONS.INVALID_PURCHASE_LEDGER]
  ]);
  assert.deepEqual(replay.paidNodeIds, [validNodeId]);
  assert.deepEqual(replay.paidNodeOccurrences[0].choices, { futureChoice: { target: "ally", levels: [1, 2] } });
  assert.equal(replay.errors.some((error) => error.purchaseIndex === 3), false, "choice contents and future record fields remain extensible");
});

test("ordered replay permits down, horizontal, and up connector traversal", () => {
  const operative = character({
    additionalSpecializationIds: ["universal:recruit"],
    talentPurchases: purchases(
      "universal:recruit:r1c1", // top row entry
      "universal:recruit:r2c1", // down from r1c1
      "universal:recruit:r3c1", // down from r2c1
      "universal:recruit:r3c2", // horizontal from r3c1
      "universal:recruit:r2c2" // up from r3c2; r1c2 was not purchased
    )
  });

  const replay = replayTalentPurchases(operative);
  assert.equal(replay.valid, true);
  assert.deepEqual(replay.paidNodeIds, purchaseNodeIds(operative));
  assert.deepEqual(
    new Set(replay.treeSummaries.find((tree) => tree.specializationGlobalId === "universal:recruit").effectiveNodeIds),
    new Set(purchaseNodeIds(operative))
  );
});

test("species rank grants are structured acquisition sources and never satisfy ranked nodes", () => {
  const operative = character({
    speciesId: "droid",
    careerId: "engineer",
    specializationId: "mechanic",
    talentPurchases: purchases(
      "engineer:mechanic:r1c2",
      "engineer:mechanic:r2c2",
      "engineer:mechanic:r3c2"
    )
  });

  const beforePurchase = talentNodeEligibility(character({ speciesId: "droid", careerId: "engineer", specializationId: "mechanic" }), "engineer:mechanic:r3c2");
  assert.equal(beforePurchase.rulesEligible, false);
  assert.equal(beforePurchase.reason, TALENT_NODE_REASONS.UNREACHABLE_NODE);

  const ranks = ownedTalentRanks(operative);
  assert.equal(ranks.enduring.rank, 2, "the paid ranked occurrence adds to the droid's species rank");
  assert.deepEqual(ranks.enduring.sources, [
    {
      kind: "species",
      speciesId: "droid",
      talentId: "enduring",
      source: "Age of Rebellion Core Rulebook, p. 54",
      sourcePage: 54,
      sourceUrl: "https://online.anyflip.com/ziisf/jobq/mobile/index.html#page=55",
      rank: 1
    },
    {
      kind: "purchase",
      talentId: "enduring",
      nodeId: "engineer:mechanic:r3c2",
      specializationGlobalId: "engineer:mechanic",
      xpCost: 15,
      purchaseIndex: 2,
      choices: {},
      rank: 1
    }
  ]);
  assert.ok(replayTalentPurchases(operative).effectiveNodeIds.includes("engineer:mechanic:r3c2"));
});

test("ranked occurrences each add a rank, including duplicate talent occurrences", () => {
  const operative = character({
    talentPurchases: purchases(
      "soldier:commando:r1c1",
      "soldier:commando:r2c1",
      "soldier:commando:r2c2",
      "soldier:commando:r2c3"
    )
  });

  const ranks = ownedTalentRanks(operative);
  assert.equal(ranks["physical-training"].rank, 2);
  assert.deepEqual(ranks["physical-training"].sources.map((source) => source.nodeId), [
    "soldier:commando:r1c1",
    "soldier:commando:r2c3"
  ]);
});

test("non-ranked duplicates become free only through reached fixed-point closure and cannot be paid twice", () => {
  const routeToImproved = character({
    careerId: "ace",
    specializationId: "driver",
    additionalSpecializationIds: ["ace:pilot"],
    talentPurchases: purchases(
      "ace:driver:r1c1", // Full Throttle makes Pilot r1c1 free from the top row
      "ace:driver:r2c1",
      "ace:driver:r3c1" // Full Throttle (Improved) is globally owned, but Pilot r3c1 is not reached yet
    )
  });
  const beforeBridge = deriveTalentState(routeToImproved);
  const pilotBeforeBridge = beforeBridge.treeSummaries.find((tree) => tree.specializationGlobalId === "ace:pilot");
  assert.ok(pilotBeforeBridge.freeNodeIds.includes("ace:pilot:r1c1"));
  assert.equal(pilotBeforeBridge.freeNodeIds.includes("ace:pilot:r3c1"), false, "unreached duplicate occurrences remain unavailable");

  const reached = {
    ...routeToImproved,
    talentPurchases: [...routeToImproved.talentPurchases, purchase("ace:pilot:r2c1")]
  };
  const state = deriveTalentState(reached);
  const pilot = state.treeSummaries.find((tree) => tree.specializationGlobalId === "ace:pilot");
  assert.ok(pilot.freeNodeIds.includes("ace:pilot:r3c1"));
  assert.ok(pilot.effectiveNodeIds.includes("ace:pilot:r3c1"));

  const extraPurchase = replayTalentPurchases({
    ...reached,
    talentPurchases: [...reached.talentPurchases, purchase("ace:pilot:r3c1")]
  });
  assert.equal(extraPurchase.valid, false);
  assert.equal(extraPurchase.errors.at(-1).code, TALENT_NODE_REASONS.NON_RANKED_TALENT_ALREADY_OWNED);
  assert.equal(extraPurchase.paidNodeIds.includes("ace:pilot:r3c1"), false);
  assert.equal(talentXpSpent({ ...reached, talentPurchases: [...reached.talentPurchases, purchase("ace:pilot:r3c1")] }), 40);
});

test("replay rejects unknown, unowned, duplicate, and out-of-order purchases without retroactive legalization", () => {
  const operative = character({
    talentPurchases: purchases(
      "not:a:node",
      "ace:driver:r1c1",
      "soldier:commando:r3c2", // would be legal only after later route entries
      "soldier:commando:r1c1",
      "soldier:commando:r2c1",
      "soldier:commando:r2c2",
      "soldier:commando:r1c1"
    )
  });
  const replay = replayTalentPurchases(operative);
  assert.equal(replay.valid, false);
  assert.deepEqual(replay.errors.map((error) => error.code), [
    TALENT_NODE_REASONS.UNKNOWN_NODE,
    TALENT_NODE_REASONS.UNOWNED_TREE,
    TALENT_NODE_REASONS.UNREACHABLE_NODE,
    TALENT_NODE_REASONS.DUPLICATE_PAID_OCCURRENCE
  ]);
  assert.deepEqual(replay.paidNodeIds, [
    "soldier:commando:r1c1",
    "soldier:commando:r2c1",
    "soldier:commando:r2c2"
  ]);
  assert.equal(replay.effectiveNodeIds.includes("soldier:commando:r3c2"), false, "the earlier rejected entry is never added after later entries unlock its route");
});

test("node IDs remain collision-safe across trees, and Armor Master follows its paid Commando route", () => {
  const collisionSafe = character({
    careerId: "ace",
    specializationId: "driver",
    additionalSpecializationIds: ["universal:recruit"],
    talentPurchases: purchases("ace:driver:r1c1", "universal:recruit:r1c1")
  });
  const collisionReplay = replayTalentPurchases(collisionSafe);
  assert.deepEqual(collisionReplay.paidNodeOccurrences.map((occurrence) => [occurrence.nodeId, occurrence.specializationGlobalId, occurrence.talentId]), [
    ["ace:driver:r1c1", "ace:driver", "full-throttle"],
    ["universal:recruit:r1c1", "universal:recruit", "basic-combat-training"]
  ]);
  const options = purchasableTalentNodes(character({
    careerId: "ace",
    specializationId: "driver",
    additionalSpecializationIds: ["universal:recruit"]
  }));
  assert.ok(options.some((option) => option.nodeId === "ace:driver:r1c1" && option.specializationGlobalId === "ace:driver"));
  assert.ok(options.some((option) => option.nodeId === "universal:recruit:r1c1" && option.specializationGlobalId === "universal:recruit"));

  const armorRoute = character({
    talentPurchases: purchases(
      "soldier:commando:r1c1",
      "soldier:commando:r2c1",
      "soldier:commando:r2c2",
      "soldier:commando:r3c2"
    )
  });
  const state = deriveTalentState(armorRoute);
  assert.equal(state.talentRanks["armor-master"].rank, 1);
  assert.equal(state.talentRanks["armor-master-improved"], undefined, "Improved is a distinct global talent ID");
  assert.equal(state.talentXpSpent, 40);
  assert.equal(talentXpSpent(armorRoute), 40);
  assert.equal(talentNodeEligibility(armorRoute, "soldier:commando:r5c1").reason, TALENT_NODE_REASONS.UNREACHABLE_NODE);
});

test("eligibility describes top-row and connected routes with effective neighbor identities", () => {
  const initial = character();
  const topRow = talentNodeEligibility(initial, "soldier:commando:r1c1");
  const locked = talentNodeEligibility(initial, "soldier:commando:r2c1");
  assert.equal(topRow.eligibilityType, "top-row");
  assert.equal(topRow.rulesEligible, true);
  assert.deepEqual(topRow.effectiveNeighbors, []);
  assert.equal(locked.eligibilityType, "connected");
  assert.equal(locked.status, TALENT_NODE_STATUSES.LOCKED);
  assert.equal(locked.reason, TALENT_NODE_REASONS.UNREACHABLE_NODE);
  assert.deepEqual(locked.effectiveNeighbors, []);

  const connected = talentNodeEligibility(character({ talentPurchases: purchases("soldier:commando:r1c1") }), "soldier:commando:r2c1");
  assert.equal(connected.eligibilityType, "connected");
  assert.equal(connected.rulesEligible, true);
  assert.deepEqual(connected.effectiveNeighbors.map((neighbor) => [neighbor.nodeId, neighbor.talentId, neighbor.talentName]), [
    ["soldier:commando:r1c1", "physical-training", "Physical Training"]
  ]);
  assert.equal(connected.currentRank, 0);
  assert.equal(connected.rankAfterPurchase, 1);
});

test("deriveTalentState materializes every owned-tree node with stable UI statuses", () => {
  const operative = character({
    careerId: "ace",
    specializationId: "driver",
    additionalSpecializationIds: ["ace:pilot"],
    characteristicAdvances: { brawn: 4 },
    talentPurchases: purchases("ace:driver:r1c1")
  });
  const state = deriveTalentState(operative);
  const node = (nodeId) => state.ownedTreeNodeStates.find((entry) => entry.nodeId === nodeId);
  const owned = node("ace:driver:r1c1");
  const free = node("ace:pilot:r1c1");
  const unaffordable = node("ace:driver:r2c1");
  const locked = node("ace:driver:r5c1");

  assert.equal(state.ownedTreeNodeStates.length, 40);
  for (const entry of state.ownedTreeNodeStates) {
    assert.equal(typeof entry.talentName, "string");
    assert.equal(typeof entry.specializationName, "string");
    assert.equal(typeof entry.specializationId, "string");
    assert.equal(typeof entry.specializationGlobalId, "string");
    assert.deepEqual(entry.coordinate, { row: entry.row, column: entry.column });
    assert.equal(typeof entry.xpCost, "number");
    assert.equal(typeof entry.ranked, "boolean");
    assert.equal(typeof entry.currentRank, "number");
    assert.equal(typeof entry.rankAfterPurchase, "number");
    assert.ok(["top-row", "connected"].includes(entry.eligibilityType));
    assert.equal(typeof entry.status, "string");
    assert.equal(typeof entry.reason, "string");
  }
  assert.equal(owned.status, TALENT_NODE_STATUSES.OWNED);
  assert.equal(owned.reason, TALENT_NODE_REASONS.OWNED);
  assert.equal(free.status, TALENT_NODE_STATUSES.FREE);
  assert.equal(free.reason, TALENT_NODE_REASONS.FREE);
  assert.equal(unaffordable.status, TALENT_NODE_STATUSES.UNAFFORDABLE);
  assert.equal(unaffordable.reason, TALENT_NODE_REASONS.UNAFFORDABLE);
  assert.equal(unaffordable.rulesReason, TALENT_NODE_REASONS.AVAILABLE);
  assert.equal(locked.status, TALENT_NODE_STATUSES.LOCKED);
  assert.equal(locked.reason, TALENT_NODE_REASONS.UNREACHABLE_NODE);
  const grit = state.ownedTreeNodeStates.find((entry) => entry.talentId === "grit");
  assert.equal(grit.talentDescription, TALENTS.find((talent) => talent.id === "grit").description);
  assert.equal(talentNodeEligibility(operative, "not:a:node").talentDescription, null);
  assert.ok(state.purchasableNodeOptions.every((option) => option.rulesEligible));
  assert.ok(state.purchasableNodeOptions.some((option) => option.nodeId === unaffordable.nodeId && option.status === TALENT_NODE_STATUSES.UNAFFORDABLE));
});

test("purchasable options preserve rules eligibility independently from affordability and do not mutate characters", () => {
  const operative = character({
    characteristicAdvances: { brawn: 4 },
    talentPurchases: purchases("soldier:commando:r1c1")
  });
  const original = structuredClone(operative);
  deepFreeze(operative);

  const next = talentNodeEligibility(operative, "soldier:commando:r2c1");
  assert.equal(next.rulesEligible, true);
  assert.equal(next.status, TALENT_NODE_STATUSES.UNAFFORDABLE);
  assert.equal(next.reason, TALENT_NODE_REASONS.UNAFFORDABLE);
  assert.equal(next.rulesReason, TALENT_NODE_REASONS.AVAILABLE);
  assert.equal(next.affordable, false, "the XP result is separate from tree-route legality");
  assert.equal(next.xp.nonTalentSpent, 180);
  assert.equal(next.xp.talentSpent, 5);
  assert.equal(next.xp.remaining, -75);

  const options = purchasableTalentNodes(operative);
  assert.ok(options.some((option) => option.nodeId === "soldier:commando:r2c1" && option.specializationGlobalId === "soldier:commando" && option.rulesEligible && !option.affordable));
  deriveTalentState(operative);
  replayTalentPurchases(operative);
  assert.deepEqual(operative, original);
});

test("XP snapshots clear the talent ledger before shared XP calculations, then add replayed talent cost once", () => {
  const operative = character({
    characteristicAdvances: { brawn: 1 },
    talentPurchases: purchases("soldier:commando:r1c1", "soldier:commando:r2c1")
  });
  const ledgerCleared = { ...operative, talentPurchases: [] };
  const state = deriveTalentState(operative);

  assert.equal(nonTalentXpSpent(operative), xpSpent(ledgerCleared));
  assert.equal(state.xp.nonTalentSpent, xpSpent(ledgerCleared));
  assert.equal(state.xp.talentSpent, talentXpSpent(operative));
  assert.equal(state.xp.spent, state.xp.nonTalentSpent + state.xp.talentSpent);
  assert.equal(state.xp.remaining, state.xp.budget - state.xp.spent);
});
