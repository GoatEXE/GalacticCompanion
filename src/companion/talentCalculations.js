import { SPECIALIZATIONS, SPECIES } from "./catalog.js";
import { xpBudget, xpSpent } from "./calculations.js";
import { SPECIALIZATION_TREES } from "./specializationTrees.js";
import { TALENTS } from "./talents.js";

/**
 * Ordered, persisted acquisition ledger. `nodeId` identifies the tree
 * occurrence; `choices` deliberately remains an opaque object until a future
 * talent has acquisition-specific choices to validate or apply.
 */
export const TALENT_PURCHASE_LEDGER_FIELD = "talentPurchases";

/** Stable reasons for replay errors and UI node states. */
export const TALENT_NODE_REASONS = Object.freeze({
  AVAILABLE: "available",
  OWNED: "owned",
  FREE: "free",
  UNAFFORDABLE: "unaffordable",
  UNKNOWN_NODE: "unknown-node",
  UNOWNED_TREE: "unowned-tree",
  DUPLICATE_PAID_OCCURRENCE: "duplicate-paid-occurrence",
  NON_RANKED_TALENT_ALREADY_OWNED: "non-ranked-talent-already-owned",
  UNREACHABLE_NODE: "unreachable-node",
  INVALID_PURCHASE_LEDGER: "invalid-purchase-ledger"
});

export const TALENT_NODE_STATUSES = Object.freeze({
  AVAILABLE: "available",
  OWNED: "owned",
  FREE: "free",
  UNAFFORDABLE: "unaffordable",
  LOCKED: "locked",
  UNKNOWN: "unknown"
});

function asCharacter(character) {
  return character && typeof character === "object" ? character : {};
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function copyValue(value) {
  if (Array.isArray(value)) return value.map(copyValue);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyValue(entry)]));
  return value;
}

function specializationByGlobalId(globalId) {
  return SPECIALIZATIONS.find((specialization) => specialization.globalId === globalId) ?? null;
}

function startingSpecializationGlobalId(character) {
  const value = asCharacter(character);
  const direct = SPECIALIZATIONS.find((specialization) => specialization.careerId === value.careerId && specialization.id === value.specializationId);
  if (direct) return direct.globalId;
  return specializationByGlobalId(value.specializationId)?.globalId ?? null;
}

function additionalSpecializationGlobalIds(character) {
  const additional = Array.isArray(asCharacter(character).additionalSpecializationIds)
    ? asCharacter(character).additionalSpecializationIds
    : [];
  return additional.map((id) => specializationByGlobalId(id)?.globalId).filter(Boolean);
}

/** Starting specialization first, then distinct additional specializations. */
export function ownedTalentSpecializationIds(character) {
  const ids = [startingSpecializationGlobalId(character), ...additionalSpecializationGlobalIds(character)].filter(Boolean);
  return [...new Set(ids)];
}

function invalidLedgerError(purchaseIndex, nodeId, message) {
  return {
    purchaseIndex,
    nodeId: typeof nodeId === "string" ? nodeId : null,
    code: TALENT_NODE_REASONS.INVALID_PURCHASE_LEDGER,
    reason: TALENT_NODE_REASONS.INVALID_PURCHASE_LEDGER,
    message
  };
}

/**
 * Validates only the durable record envelope. The contents of `choices` are
 * intentionally not interpreted by this generic ownership engine.
 */
function purchaseLedger(character) {
  const ledger = asCharacter(character)[TALENT_PURCHASE_LEDGER_FIELD];
  if (ledger === undefined) return { purchases: [], errors: [] };
  if (!Array.isArray(ledger)) {
    return {
      purchases: [],
      errors: [invalidLedgerError(null, null, `${TALENT_PURCHASE_LEDGER_FIELD} must be an ordered array of { nodeId, choices } records.`)]
    };
  }

  const purchases = [];
  const errors = [];
  ledger.forEach((record, purchaseIndex) => {
    if (!isObject(record)) {
      errors.push(invalidLedgerError(purchaseIndex, null, "Each talent purchase must be an object with nodeId and choices."));
      return;
    }
    if (typeof record.nodeId !== "string" || record.nodeId.trim() === "") {
      errors.push(invalidLedgerError(purchaseIndex, record.nodeId, "Each talent purchase must include a non-empty string nodeId."));
      return;
    }
    if (!Object.hasOwn(record, "choices") || !isObject(record.choices)) {
      errors.push(invalidLedgerError(purchaseIndex, record.nodeId, "Each talent purchase must include a choices object."));
      return;
    }
    purchases.push({ purchaseIndex, nodeId: record.nodeId, choices: copyValue(record.choices) });
  });
  return { purchases, errors };
}

function catalogIndex() {
  const talentsById = new Map(TALENTS.map((talent) => [talent.id, talent]));
  const treesById = new Map(SPECIALIZATION_TREES.map((tree) => [tree.specializationGlobalId, tree]));
  const nodeById = new Map();
  const topologyByTreeId = new Map();

  for (const tree of SPECIALIZATION_TREES) {
    const adjacency = new Map(tree.nodes.map((node) => [node.id, new Set()]));
    for (const [leftId, rightId] of tree.connectors) {
      adjacency.get(leftId)?.add(rightId);
      adjacency.get(rightId)?.add(leftId);
    }
    for (const node of tree.nodes) nodeById.set(node.id, { node, tree });
    topologyByTreeId.set(tree.specializationGlobalId, {
      entryNodeIds: new Set(tree.requirements.entryNodeIds),
      adjacency
    });
  }
  return { talentsById, treesById, nodeById, topologyByTreeId };
}

function cloneSource(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined).map(([key, value]) => [key, copyValue(value)]));
}

function addTalentRank(talentRanks, talent, source, rank = 1) {
  if (!talent || rank <= 0) return;
  const existing = talentRanks.get(talent.id);
  // Non-ranked talents are globally binary, including any future malformed
  // grant. Replay rejects duplicate paid acquisitions before getting here.
  const appliedRank = talent.ranked ? rank : (existing ? 0 : 1);
  if (appliedRank === 0) return;
  const entry = existing ?? {
    talentId: talent.id,
    name: talent.name,
    ranked: talent.ranked,
    rank: 0,
    sources: []
  };
  entry.rank += appliedRank;
  entry.sources.push(cloneSource({ ...source, rank: appliedRank }));
  talentRanks.set(talent.id, entry);
}

function speciesTalentGrants(character) {
  const species = SPECIES.find((entry) => entry.id === asCharacter(character).speciesId);
  const grants = Array.isArray(species?.setup?.startingTalentRanks) ? species.setup.startingTalentRanks : [];
  return { species, grants };
}

function hasTalent(talentRanks, talentId) {
  return (talentRanks.get(talentId)?.rank ?? 0) > 0;
}

function isTopRowNode(nodeId, treeId, index) {
  return index.topologyByTreeId.get(treeId)?.entryNodeIds.has(nodeId) ?? false;
}

function effectiveNeighborIds(nodeId, treeId, effectiveByTree, index) {
  const effective = effectiveByTree.get(treeId) ?? new Set();
  return [...(index.topologyByTreeId.get(treeId)?.adjacency.get(nodeId) ?? [])].filter((neighborId) => effective.has(neighborId));
}

function isConnectedToEffectiveNode(nodeId, treeId, effectiveByTree, index) {
  return isTopRowNode(nodeId, treeId, index) || effectiveNeighborIds(nodeId, treeId, effectiveByTree, index).length > 0;
}

/**
 * Globally owned non-ranked occurrences are free bridge nodes only after they
 * are reached. Running this closure between ledger records preserves ordered,
 * reached-only acquisition rules.
 */
function applyReachedFreeNodeClosure(ownedTreeIds, effectiveByTree, freeByTree, talentRanks, index) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const treeId of ownedTreeIds) {
      const tree = index.treesById.get(treeId);
      const effective = effectiveByTree.get(treeId);
      const free = freeByTree.get(treeId);
      if (!tree || !effective || !free) continue;
      for (const node of tree.nodes) {
        const talent = index.talentsById.get(node.talentId);
        if (effective.has(node.id) || !talent || talent.ranked || !hasTalent(talentRanks, talent.id)) continue;
        if (isConnectedToEffectiveNode(node.id, treeId, effectiveByTree, index)) {
          effective.add(node.id);
          free.add(node.id);
          changed = true;
        }
      }
    }
  }
}

function errorFor(purchaseIndex, nodeId, code, message) {
  return { purchaseIndex, nodeId, code, reason: code, message };
}

function materializeTalentRanks(talentRanks) {
  return Object.fromEntries([...talentRanks.entries()].map(([talentId, value]) => [talentId, {
    ...value,
    sources: value.sources.map((source) => cloneSource(source))
  }]));
}

function replay(character) {
  const value = asCharacter(character);
  const index = catalogIndex();
  const ownedTreeIds = ownedTalentSpecializationIds(value).filter((treeId) => index.treesById.has(treeId));
  const ownedTreeIdSet = new Set(ownedTreeIds);
  const effectiveByTree = new Map(ownedTreeIds.map((treeId) => [treeId, new Set()]));
  const freeByTree = new Map(ownedTreeIds.map((treeId) => [treeId, new Set()]));
  const paidNodeIds = [];
  const paidNodeSet = new Set();
  const paidPurchasesByNodeId = new Map();
  const seenNodeIds = new Set();
  const talentRanks = new Map();
  const ledger = purchaseLedger(value);
  const errors = [...ledger.errors];
  const { species, grants } = speciesTalentGrants(value);

  for (const grant of grants) {
    const talent = index.talentsById.get(grant?.talentId);
    if (!talent || !Number.isInteger(grant?.rank) || grant.rank < 1) continue;
    addTalentRank(talentRanks, talent, {
      kind: "species",
      speciesId: species.id,
      talentId: talent.id,
      source: grant.source,
      sourcePage: grant.sourcePage,
      sourceUrl: grant.sourceUrl
    }, grant.rank);
  }
  applyReachedFreeNodeClosure(ownedTreeIds, effectiveByTree, freeByTree, talentRanks, index);

  for (const purchase of ledger.purchases) {
    const { nodeId, choices, purchaseIndex } = purchase;
    const occurrence = index.nodeById.get(nodeId);
    if (!occurrence) {
      errors.push(errorFor(purchaseIndex, nodeId, TALENT_NODE_REASONS.UNKNOWN_NODE, "Talent purchase references an unknown node occurrence."));
      continue;
    }
    if (seenNodeIds.has(nodeId)) {
      errors.push(errorFor(purchaseIndex, nodeId, TALENT_NODE_REASONS.DUPLICATE_PAID_OCCURRENCE, "A talent node occurrence can only be paid for once."));
      continue;
    }
    seenNodeIds.add(nodeId);

    const { node, tree } = occurrence;
    if (!ownedTreeIdSet.has(tree.specializationGlobalId)) {
      errors.push(errorFor(purchaseIndex, nodeId, TALENT_NODE_REASONS.UNOWNED_TREE, "Talent purchases require ownership of that specialization tree."));
      continue;
    }
    const talent = index.talentsById.get(node.talentId);
    if (!talent) {
      errors.push(errorFor(purchaseIndex, nodeId, TALENT_NODE_REASONS.UNKNOWN_NODE, "Talent purchase references an unknown talent."));
      continue;
    }
    if (!talent.ranked && hasTalent(talentRanks, talent.id)) {
      errors.push(errorFor(purchaseIndex, nodeId, TALENT_NODE_REASONS.NON_RANKED_TALENT_ALREADY_OWNED, "A non-ranked talent is already globally owned and cannot be paid for again."));
      continue;
    }
    if (!isConnectedToEffectiveNode(node.id, tree.specializationGlobalId, effectiveByTree, index)) {
      errors.push(errorFor(purchaseIndex, nodeId, TALENT_NODE_REASONS.UNREACHABLE_NODE, "Talent purchases must start in the top row or connect to an already effective node."));
      continue;
    }

    paidNodeIds.push(node.id);
    paidNodeSet.add(node.id);
    paidPurchasesByNodeId.set(node.id, purchase);
    effectiveByTree.get(tree.specializationGlobalId).add(node.id);
    addTalentRank(talentRanks, talent, {
      kind: "purchase",
      talentId: talent.id,
      nodeId: node.id,
      specializationGlobalId: tree.specializationGlobalId,
      xpCost: node.xpCost,
      purchaseIndex,
      choices
    });
    applyReachedFreeNodeClosure(ownedTreeIds, effectiveByTree, freeByTree, talentRanks, index);
  }

  return {
    character: value,
    index,
    ownedTreeIds,
    paidNodeIds,
    paidNodeSet,
    paidPurchasesByNodeId,
    seenNodeIds,
    effectiveByTree,
    freeByTree,
    talentRanks,
    errors
  };
}

function paidTalentXp(state) {
  return state.paidNodeIds.reduce((total, nodeId) => total + (state.index.nodeById.get(nodeId)?.node.xpCost ?? 0), 0);
}

/**
 * Runs the shared XP calculation against an explicitly ledger-cleared copy.
 * The shared total includes talent nodes, so clearing the ledger prevents the
 * ownership snapshot from counting replay-derived node costs twice.
 */
export function nonTalentXpSpent(character) {
  return xpSpent({ ...asCharacter(character), [TALENT_PURCHASE_LEDGER_FIELD]: [] });
}

function xpSnapshot(character, talentSpent) {
  const budget = xpBudget(asCharacter(character));
  const nonTalentSpent = nonTalentXpSpent(character);
  const spent = nonTalentSpent + talentSpent;
  return { budget, nonTalentSpent, talentSpent, spent, remaining: budget - spent };
}

function specializationIdentity(tree) {
  const specialization = specializationByGlobalId(tree.specializationGlobalId);
  return {
    specializationId: specialization?.id ?? tree.specializationGlobalId,
    specializationGlobalId: tree.specializationGlobalId,
    specializationName: specialization?.name ?? tree.specializationGlobalId,
    source: tree?.source ? {
      printedPage: tree.source.printedPage,
      sourceUrl: tree.source.sourceUrl
    } : null
  };
}

function nodeIdentity(node, tree, index) {
  const talent = index.talentsById.get(node.talentId);
  return {
    nodeId: node.id,
    ...specializationIdentity(tree),
    talentId: node.talentId,
    talentName: talent?.name ?? node.talentId,
    talentDescription: talent?.description ?? null,
    talentSource: talent ? {
      printedPage: talent.sourcePage,
      sourceUrl: talent.sourceUrl
    } : null,
    coordinate: { row: node.row, column: node.column },
    row: node.row,
    column: node.column,
    xpCost: node.xpCost,
    cost: node.xpCost,
    ranked: Boolean(talent?.ranked)
  };
}

function unknownEligibility(nodeId, xp) {
  return {
    nodeId: typeof nodeId === "string" ? nodeId : null,
    specializationId: null,
    specializationGlobalId: null,
    specializationName: null,
    talentId: null,
    talentName: null,
    talentDescription: null,
    coordinate: null,
    row: null,
    column: null,
    xpCost: 0,
    cost: 0,
    ranked: false,
    currentRank: 0,
    rankAfterPurchase: 0,
    eligibilityType: null,
    effectiveNeighbors: [],
    neighborNodes: [],
    paid: false,
    free: false,
    effective: false,
    satisfied: false,
    status: TALENT_NODE_STATUSES.UNKNOWN,
    reason: TALENT_NODE_REASONS.UNKNOWN_NODE,
    rulesReason: TALENT_NODE_REASONS.UNKNOWN_NODE,
    rulesEligible: false,
    affordable: false,
    xp: { ...xp, remainingAfterPurchase: xp.remaining }
  };
}

/** Builds the complete UI state for a node without asking a caller to replay rules. */
function nodeStateFor(state, nodeId, xp) {
  const occurrence = state.index.nodeById.get(nodeId);
  if (!occurrence) return unknownEligibility(nodeId, xp);

  const { node, tree } = occurrence;
  const identity = nodeIdentity(node, tree, state.index);
  const talent = state.index.talentsById.get(node.talentId);
  const treeOwned = state.ownedTreeIds.includes(tree.specializationGlobalId);
  const paid = state.paidNodeSet.has(node.id);
  const free = (state.freeByTree.get(tree.specializationGlobalId) ?? new Set()).has(node.id);
  const effective = (state.effectiveByTree.get(tree.specializationGlobalId) ?? new Set()).has(node.id);
  const eligibilityType = isTopRowNode(node.id, tree.specializationGlobalId, state.index) ? "top-row" : "connected";
  const effectiveNeighbors = eligibilityType === "connected"
    ? effectiveNeighborIds(node.id, tree.specializationGlobalId, state.effectiveByTree, state.index)
      .map((neighborId) => {
        const neighbor = state.index.nodeById.get(neighborId);
        return nodeIdentity(neighbor.node, neighbor.tree, state.index);
      })
    : [];
  const neighborNodes = [...(state.index.topologyByTreeId.get(tree.specializationGlobalId)?.adjacency.get(node.id) ?? [])]
    .map((neighborId) => {
      const neighbor = state.index.nodeById.get(neighborId);
      return nodeIdentity(neighbor.node, neighbor.tree, state.index);
    });

  let rulesReason = TALENT_NODE_REASONS.AVAILABLE;
  if (!treeOwned) rulesReason = TALENT_NODE_REASONS.UNOWNED_TREE;
  else if (paid || state.seenNodeIds.has(node.id)) rulesReason = TALENT_NODE_REASONS.DUPLICATE_PAID_OCCURRENCE;
  else if (free || (!talent?.ranked && hasTalent(state.talentRanks, node.talentId))) rulesReason = TALENT_NODE_REASONS.NON_RANKED_TALENT_ALREADY_OWNED;
  else if (!isConnectedToEffectiveNode(node.id, tree.specializationGlobalId, state.effectiveByTree, state.index)) rulesReason = TALENT_NODE_REASONS.UNREACHABLE_NODE;

  const rulesEligible = rulesReason === TALENT_NODE_REASONS.AVAILABLE;
  const affordable = rulesEligible && xp.remaining >= node.xpCost;
  const status = paid
    ? TALENT_NODE_STATUSES.OWNED
    : free
      ? TALENT_NODE_STATUSES.FREE
      : !rulesEligible
        ? TALENT_NODE_STATUSES.LOCKED
        : affordable
          ? TALENT_NODE_STATUSES.AVAILABLE
          : TALENT_NODE_STATUSES.UNAFFORDABLE;
  const reason = status === TALENT_NODE_STATUSES.OWNED
    ? TALENT_NODE_REASONS.OWNED
    : status === TALENT_NODE_STATUSES.FREE
      ? TALENT_NODE_REASONS.FREE
      : status === TALENT_NODE_STATUSES.UNAFFORDABLE
        ? TALENT_NODE_REASONS.UNAFFORDABLE
        : rulesReason;
  const currentRank = state.talentRanks.get(node.talentId)?.rank ?? 0;
  const rankAfterPurchase = rulesEligible ? (talent?.ranked ? currentRank + 1 : 1) : currentRank;

  return {
    ...identity,
    currentRank,
    rankAfterPurchase,
    eligibilityType,
    effectiveNeighbors,
    neighborNodes,
    paid,
    free,
    effective,
    satisfied: effective,
    status,
    reason,
    rulesReason,
    rulesEligible,
    affordable,
    xp: { ...xp, remainingAfterPurchase: xp.remaining - node.xpCost }
  };
}

function materializeTreeSummaries(state, xp) {
  return state.ownedTreeIds.map((specializationGlobalId) => {
    const tree = state.index.treesById.get(specializationGlobalId);
    const nodes = (tree?.nodes ?? []).map((node) => nodeStateFor(state, node.id, xp));
    const paidNodes = nodes.filter((node) => node.paid);
    const freeNodes = nodes.filter((node) => node.free);
    const effectiveNodes = nodes.filter((node) => node.effective);
    return {
      ...specializationIdentity(tree),
      totalNodeCount: nodes.length,
      paidNodeIds: paidNodes.map((node) => node.nodeId),
      paidNodeCount: paidNodes.length,
      freeNodeIds: freeNodes.map((node) => node.nodeId),
      freeNodeCount: freeNodes.length,
      effectiveNodeIds: effectiveNodes.map((node) => node.nodeId),
      satisfiedNodeIds: effectiveNodes.map((node) => node.nodeId),
      effectiveNodeCount: effectiveNodes.length,
      paidXp: paidNodes.reduce((total, node) => total + node.xpCost, 0),
      nodes
    };
  });
}

function replaySnapshot(state) {
  const talentSpent = paidTalentXp(state);
  const xp = xpSnapshot(state.character, talentSpent);
  const treeSummaries = materializeTreeSummaries(state, xp);
  const paidNodeOccurrences = state.paidNodeIds.map((nodeId) => {
    const occurrence = state.index.nodeById.get(nodeId);
    const purchase = state.paidPurchasesByNodeId.get(nodeId);
    return { ...nodeIdentity(occurrence.node, occurrence.tree, state.index), choices: copyValue(purchase?.choices ?? {}) };
  });
  const effectiveNodeIds = treeSummaries.flatMap((summary) => summary.effectiveNodeIds);
  const freeNodeIds = treeSummaries.flatMap((summary) => summary.freeNodeIds);
  const ownedTreeNodeStates = treeSummaries.flatMap((summary) => summary.nodes);
  return {
    valid: state.errors.length === 0,
    errors: state.errors.map((error) => ({ ...error })),
    ownedSpecializationGlobalIds: [...state.ownedTreeIds],
    paidNodeIds: [...state.paidNodeIds],
    paidNodeOccurrences,
    effectiveNodeIds,
    satisfiedNodeIds: [...effectiveNodeIds],
    freeNodeIds,
    talentRanks: materializeTalentRanks(state.talentRanks),
    treeSummaries,
    ownedTreeNodeStates,
    talentXpSpent: talentSpent,
    xp
  };
}

/** Replays the ordered purchase ledger without modifying the character. */
export function replayTalentPurchases(character) {
  return replaySnapshot(replay(character));
}

/** Returns talent ownership keyed by talent ID, including rank and all sources. */
export function ownedTalentRanks(character) {
  return replaySnapshot(replay(character)).talentRanks;
}

/** Returns only XP charged by valid paid talent-node occurrences. */
export function talentXpSpent(character) {
  return paidTalentXp(replay(character));
}

/**
 * Returns a minimal copy of ledger records not belonging to one tree. This is
 * deliberately based on node occurrences, rather than an ID prefix, so the
 * persistence layer stays coupled to the accepted catalogue rules.
 */
export function talentPurchasesWithoutSpecialization(character, specializationGlobalId) {
  const state = replay(character);
  return purchaseLedger(asCharacter(character)).purchases
    .filter(({ nodeId }) => state.index.nodeById.get(nodeId)?.tree.specializationGlobalId !== specializationGlobalId)
    .map(({ nodeId, choices }) => ({ nodeId, choices: copyValue(choices) }));
}

/**
 * Explains why removing an additional specialization would invalidate talent
 * ownership. Direct purchases must be undone first; then retained purchases
 * are replayed without the removed tree to catch cross-tree free-node paths.
 */
export function talentSpecializationUndoBlockReason(character, specializationGlobalId) {
  const state = replay(character);
  const directPurchases = state.paidNodeIds
    .map((nodeId) => {
      const occurrence = state.index.nodeById.get(nodeId);
      return occurrence ? { nodeId, specializationGlobalId: occurrence.tree.specializationGlobalId } : null;
    })
    .filter(Boolean);
  const directInRemovedTree = directPurchases.filter((purchase) => purchase.specializationGlobalId === specializationGlobalId);
  const afterUndo = {
    ...asCharacter(character),
    additionalSpecializationIds: additionalSpecializationGlobalIds(character).filter((id) => id !== specializationGlobalId),
    [TALENT_PURCHASE_LEDGER_FIELD]: talentPurchasesWithoutSpecialization(character, specializationGlobalId)
  };
  const retained = replayTalentPurchases(afterUndo);
  if (!retained.valid) {
    const invalid = retained.errors[0];
    return `Undo unavailable: Retained talent purchase ${invalid.nodeId ?? "records"} would no longer be valid without this specialization.`;
  }
  if (directInRemovedTree.length) {
    return "Undo unavailable: Remove purchased talent nodes from this specialization before undoing it.";
  }
  return "";
}

/**
 * Evaluates one prospective purchase. Rules legality and affordability remain
 * separate, while the returned status/reason is ready for direct UI display.
 */
export function talentNodeEligibility(character, nodeId) {
  const state = replay(character);
  return nodeStateFor(state, nodeId, xpSnapshot(state.character, paidTalentXp(state)));
}

/** Lists every currently rule-eligible occurrence in every owned tree. */
export function purchasableTalentNodes(character) {
  const state = replay(character);
  const xp = xpSnapshot(state.character, paidTalentXp(state));
  return state.ownedTreeIds.flatMap((treeId) => (state.index.treesById.get(treeId)?.nodes ?? [])
    .map((node) => nodeStateFor(state, node.id, xp))
    .filter((option) => option.rulesEligible));
}

/**
 * Complete, pure UI contract for talent ownership, node states, options, and
 * XP. React can render this output without reconstructing path or rank rules.
 */
export function deriveTalentState(character) {
  const state = replay(character);
  const snapshot = replaySnapshot(state);
  return {
    ...snapshot,
    startingSpecializationGlobalId: startingSpecializationGlobalId(character),
    additionalSpecializationGlobalIds: additionalSpecializationGlobalIds(character),
    purchasableNodeOptions: snapshot.ownedTreeNodeStates.filter((node) => node.rulesEligible)
  };
}
