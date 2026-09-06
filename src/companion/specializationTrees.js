import treeData from "./specialization-trees.json" with { type: "json" };
import { SPECIALIZATIONS } from "./catalog.js";
import { TALENTS } from "./talents.js";

export const CORE_SPECIALIZATION_TREE_COUNT = 19;
export const TREE_ROWS = 5;
export const TREE_COLUMNS = 4;
export const TREE_NODE_COUNT = TREE_ROWS * TREE_COLUMNS;
export const TREE_CONNECTOR_TRAVERSAL = "purchased-path";

export const SPECIALIZATION_TREE_CATALOG = Object.freeze(treeData);
export const SPECIALIZATION_TREES = Object.freeze(treeData.trees);

const SOURCE_URL_PREFIX = "https://online.anyflip.com/ziisf/jobq/mobile/index.html#page=";
const CORE_RULEBOOK = "Age of Rebellion Core Rulebook";

function coordinateKey(row, column) {
  return `r${row}c${column}`;
}

function coordinateCompare(left, right) {
  return left.row - right.row || left.column - right.column;
}

function sameEntries(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

/**
 * Validates source definitions only. Purchase state, XP accounting, and talent
 * mechanics intentionally remain outside this compact tree catalogue.
 */
export function validateSpecializationTreeCatalog(
  catalog = SPECIALIZATION_TREE_CATALOG,
  { specializations = SPECIALIZATIONS, talents = TALENTS } = {}
) {
  const errors = [];
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return ["Specialization tree catalogue must be an object."];
  if (catalog.schemaVersion !== 1) errors.push("Unsupported specialization tree catalogue version.");
  if (catalog.source?.rulebook !== CORE_RULEBOOK || catalog.source?.anyFlipFragmentMapping !== "printed page + 1") {
    errors.push("Specialization tree catalogue must identify the audited Core Rulebook source mapping.");
  }
  if (!Array.isArray(catalog.trees)) return [...errors, "Specialization tree catalogue must include a tree array."];

  const expectedSpecializationIds = new Set(specializations.map((specialization) => specialization.globalId));
  const talentById = new Map(talents.map((talent) => [talent.id, talent]));
  const treeIds = new Set();
  const occurrenceIds = new Set();

  if (catalog.trees.length !== CORE_SPECIALIZATION_TREE_COUNT) {
    errors.push(`Core specialization tree catalogue must contain ${CORE_SPECIALIZATION_TREE_COUNT} trees.`);
  }

  catalog.trees.forEach((tree, treeIndex) => {
    const label = `Tree at index ${treeIndex}`;
    if (!tree || typeof tree !== "object" || Array.isArray(tree)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    const globalId = tree.specializationGlobalId;
    if (typeof globalId !== "string" || !expectedSpecializationIds.has(globalId)) {
      errors.push(`${label} must reference a known Core specialization global id.`);
      return;
    }
    if (treeIds.has(globalId)) errors.push(`Duplicate specialization tree: ${globalId}.`);
    treeIds.add(globalId);

    const source = tree.source;
    if (!source || !Number.isInteger(source.printedPage) || source.printedPage < 1 || source.anyFlipFragmentPage !== source.printedPage + 1 || source.sourceUrl !== `${SOURCE_URL_PREFIX}${source.printedPage + 1}`) {
      errors.push(`${globalId} must include an audited printed page and direct AnyFlip URL.`);
    }

    if (!Array.isArray(tree.nodes) || tree.nodes.length !== TREE_NODE_COUNT) {
      errors.push(`${globalId} must contain ${TREE_NODE_COUNT} talent occurrences.`);
    }
    const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
    const nodeById = new Map();
    const coordinateIds = new Set();
    nodes.forEach((node, nodeIndex) => {
      const nodeLabel = `${globalId} node at index ${nodeIndex}`;
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        errors.push(`${nodeLabel} must be an object.`);
        return;
      }
      const expectedId = `${globalId}:r${node.row}c${node.column}`;
      if (!Number.isInteger(node.row) || node.row < 1 || node.row > TREE_ROWS || !Number.isInteger(node.column) || node.column < 1 || node.column > TREE_COLUMNS || node.id !== expectedId) {
        errors.push(`${nodeLabel} must use a canonical <specializationGlobalId>:rNcN occurrence id.`);
      }
      if (node.xpCost !== node.row * 5) errors.push(`${nodeLabel} must cost row × 5 XP.`);
      if (typeof node.talentId !== "string" || !talentById.has(node.talentId)) {
        errors.push(`${nodeLabel} must reference a talent from the Core talent catalogue.`);
      } else if (talentById.get(node.talentId).npcOnly) {
        errors.push(`${nodeLabel} cannot reference an NPC-only talent.`);
      }
      if (nodeById.has(node.id)) errors.push(`Duplicate node id: ${node.id}.`);
      nodeById.set(node.id, node);
      if (occurrenceIds.has(node.id)) errors.push(`Duplicate tree occurrence id: ${node.id}.`);
      occurrenceIds.add(node.id);
      const key = coordinateKey(node.row, node.column);
      if (coordinateIds.has(key)) errors.push(`Duplicate coordinate in ${globalId}: ${key}.`);
      coordinateIds.add(key);
    });

    for (let row = 1; row <= TREE_ROWS; row += 1) {
      for (let column = 1; column <= TREE_COLUMNS; column += 1) {
        const nodeId = `${globalId}:r${row}c${column}`;
        if (!nodeById.has(nodeId)) errors.push(`${globalId} is missing coordinate ${coordinateKey(row, column)}.`);
      }
    }

    const topRowIds = nodes.filter((node) => node?.row === 1).sort(coordinateCompare).map((node) => node.id);
    const requirements = tree.requirements;
    if (!requirements || requirements.availableSpecializationGlobalId !== globalId || requirements.connectorTraversal !== TREE_CONNECTOR_TRAVERSAL || !Array.isArray(requirements.entryNodeIds) || !sameEntries([...requirements.entryNodeIds].sort((left, right) => coordinateCompare(nodeById.get(left) ?? {}, nodeById.get(right) ?? {})), topRowIds)) {
      errors.push(`${globalId} must explicitly define its available specialization, purchased-path traversal, and complete top-row entry nodes.`);
    }

    const adjacency = new Map([...nodeById.keys()].map((nodeId) => [nodeId, new Set()]));
    if (!Array.isArray(tree.connectors)) {
      errors.push(`${globalId} must include a connector array.`);
    } else {
      const connectorPairs = new Set();
      tree.connectors.forEach((connector, connectorIndex) => {
        const connectorLabel = `${globalId} connector at index ${connectorIndex}`;
        if (!Array.isArray(connector) || connector.length !== 2) {
          errors.push(`${connectorLabel} must be a pair of occurrence ids.`);
          return;
        }
        const [leftId, rightId] = connector;
        const left = nodeById.get(leftId);
        const right = nodeById.get(rightId);
        if (!left || !right || !leftId.startsWith(`${globalId}:`) || !rightId.startsWith(`${globalId}:`)) {
          errors.push(`${connectorLabel} must stay within its tree and reference known occurrences.`);
          return;
        }
        if (coordinateCompare(left, right) >= 0) errors.push(`${connectorLabel} must be listed in canonical coordinate order.`);
        if (Math.abs(left.row - right.row) + Math.abs(left.column - right.column) !== 1) {
          errors.push(`${connectorLabel} must join orthogonally adjacent occurrences.`);
        }
        adjacency.get(leftId).add(rightId);
        adjacency.get(rightId).add(leftId);
        const pair = [leftId, rightId].sort().join("|");
        if (connectorPairs.has(pair)) errors.push(`Duplicate connector in ${globalId}: ${pair}.`);
        connectorPairs.add(pair);
      });
    }

    const reachable = new Set((requirements?.entryNodeIds ?? []).filter((nodeId) => nodeById.has(nodeId)));
    const pending = [...reachable];
    while (pending.length) {
      const nodeId = pending.pop();
      for (const neighborId of adjacency.get(nodeId) ?? []) {
        if (!reachable.has(neighborId)) {
          reachable.add(neighborId);
          pending.push(neighborId);
        }
      }
    }
    if (reachable.size !== nodeById.size) errors.push(`${globalId} must make every occurrence reachable from its top-row entry nodes.`);

    if (nodes.filter((node) => node?.talentId === "dedication").length !== 1) {
      errors.push(`${globalId} must contain exactly one Dedication occurrence.`);
    }
  });

  for (const globalId of expectedSpecializationIds) {
    if (!treeIds.has(globalId)) errors.push(`Missing Core specialization tree: ${globalId}.`);
  }
  return errors;
}

export function findSpecializationTree(specializationGlobalId) {
  return SPECIALIZATION_TREES.find((tree) => tree.specializationGlobalId === specializationGlobalId) ?? null;
}
