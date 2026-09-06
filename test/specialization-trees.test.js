import test from "node:test";
import assert from "node:assert/strict";
import { SPECIALIZATIONS, SPECIES, UNIVERSAL_SPECIALIZATIONS } from "../src/companion/catalog.js";
import { findTalent, TALENTS } from "../src/companion/talents.js";
import {
  CORE_SPECIALIZATION_TREE_COUNT,
  SPECIALIZATION_TREE_CATALOG,
  SPECIALIZATION_TREES,
  TREE_COLUMNS,
  TREE_NODE_COUNT,
  TREE_ROWS,
  findSpecializationTree,
  validateSpecializationTreeCatalog
} from "../src/companion/specializationTrees.js";

const AUDITED_TREE_SOURCES = [
  ["ace:driver", 67], ["ace:gunner", 68], ["ace:pilot", 69],
  ["commander:commodore", 73], ["commander:squadron-leader", 74], ["commander:tactician", 75],
  ["diplomat:ambassador", 79], ["diplomat:agitator", 80], ["diplomat:quartermaster", 81],
  ["engineer:mechanic", 85], ["engineer:saboteur", 86], ["engineer:scientist", 87],
  ["soldier:commando", 91], ["soldier:medic", 92], ["soldier:sharpshooter", 93],
  ["spy:infiltrator", 97], ["spy:scout", 98], ["spy:slicer", 99], ["universal:recruit", 101]
];

const ANYFLIP_URL = "https://online.anyflip.com/ziisf/jobq/mobile/index.html#page=";

test("Core specialization tree catalogue covers every Core specialization and Recruit", () => {
  assert.equal(CORE_SPECIALIZATION_TREE_COUNT, 19);
  assert.equal(SPECIALIZATION_TREES.length, CORE_SPECIALIZATION_TREE_COUNT);
  assert.equal(SPECIALIZATION_TREES.reduce((sum, tree) => sum + tree.nodes.length, 0), 380);
  assert.deepEqual(
    SPECIALIZATION_TREES.map((tree) => tree.specializationGlobalId).sort(),
    SPECIALIZATIONS.map((specialization) => specialization.globalId).sort()
  );
  assert.deepEqual(validateSpecializationTreeCatalog(), []);
  assert.equal(findSpecializationTree("engineer:scientist")?.specializationGlobalId, "engineer:scientist");
  assert.equal(findSpecializationTree("not-a-specialization"), null);
});

test("tree occurrences, connectors, sources, and explicit top-row entry requirements are complete", () => {
  assert.deepEqual(
    SPECIALIZATION_TREES.map((tree) => [tree.specializationGlobalId, tree.source.printedPage]),
    AUDITED_TREE_SOURCES
  );
  const occurrenceIds = new Set();
  for (const tree of SPECIALIZATION_TREES) {
    assert.equal(tree.nodes.length, TREE_NODE_COUNT);
    assert.equal(tree.source.anyFlipFragmentPage, tree.source.printedPage + 1);
    assert.equal(tree.source.sourceUrl, `${ANYFLIP_URL}${tree.source.anyFlipFragmentPage}`);
    assert.equal(tree.requirements.availableSpecializationGlobalId, tree.specializationGlobalId);
    assert.equal(tree.requirements.connectorTraversal, "purchased-path");

    const byId = new Map(tree.nodes.map((node) => [node.id, node]));
    assert.equal(byId.size, TREE_NODE_COUNT);
    for (let row = 1; row <= TREE_ROWS; row += 1) {
      for (let column = 1; column <= TREE_COLUMNS; column += 1) {
        const id = `${tree.specializationGlobalId}:r${row}c${column}`;
        const node = byId.get(id);
        assert.ok(node, `${tree.specializationGlobalId} includes ${id}`);
        assert.equal(node.xpCost, row * 5);
        assert.ok(findTalent(node.talentId));
        assert.equal(findTalent(node.talentId)?.npcOnly, false);
        assert.equal(occurrenceIds.has(id), false, `${id} is globally unique`);
        occurrenceIds.add(id);
      }
    }

    const topRowIds = tree.nodes.filter((node) => node.row === 1).map((node) => node.id);
    assert.deepEqual(tree.requirements.entryNodeIds, topRowIds);
    assert.equal(topRowIds.length, TREE_COLUMNS);
    assert.equal(tree.nodes.filter((node) => node.talentId === "dedication").length, 1);

    const connectorIds = new Set();
    const reachable = new Set(topRowIds);
    const pending = [...topRowIds];
    for (const [leftId, rightId] of tree.connectors) {
      const left = byId.get(leftId);
      const right = byId.get(rightId);
      assert.ok(left && right);
      assert.equal(leftId.startsWith(`${tree.specializationGlobalId}:`), true);
      assert.equal(rightId.startsWith(`${tree.specializationGlobalId}:`), true);
      assert.equal(Math.abs(left.row - right.row) + Math.abs(left.column - right.column), 1);
      assert.ok(left.row < right.row || (left.row === right.row && left.column < right.column));
      const key = `${leftId}|${rightId}`;
      assert.equal(connectorIds.has(key), false, `${tree.specializationGlobalId} connector ${key} is unique`);
      connectorIds.add(key);
    }
    while (pending.length) {
      const nodeId = pending.pop();
      for (const [leftId, rightId] of tree.connectors) {
        const neighborId = leftId === nodeId ? rightId : rightId === nodeId ? leftId : null;
        if (neighborId && !reachable.has(neighborId)) {
          reachable.add(neighborId);
          pending.push(neighborId);
        }
      }
    }
    assert.equal(reachable.size, TREE_NODE_COUNT, `${tree.specializationGlobalId} is reachable from its top-row entries`);
  }
  assert.equal(occurrenceIds.size, 380);
});

test("audited Scientist, Commando, definition-page boundary, and Recruit source sentinels remain stable", () => {
  assert.equal(findSpecializationTree("engineer:scientist").nodes.find((node) => node.id === "engineer:scientist:r3c4")?.talentId, "inventor");
  assert.equal(findSpecializationTree("soldier:commando").nodes.find((node) => node.id === "soldier:commando:r3c2")?.talentId, "armor-master");
  assert.equal(findTalent("mental-fortress")?.sourcePage, 151);
  assert.equal(TALENTS.some((talent) => talent.sourcePage === 152), false, "printed p.152 is the audited illustration boundary");
  assert.equal(findTalent("natural-brawler")?.sourcePage, 153);
  assert.deepEqual(UNIVERSAL_SPECIALIZATIONS.find((specialization) => specialization.id === "recruit"), {
    id: "recruit",
    globalId: "universal:recruit",
    name: "Recruit",
    careerId: null,
    universal: true,
    skillIds: ["athletics", "discipline", "survival", "vigilance"],
    source: "Age of Rebellion Core Rulebook, p. 100",
    sourceUrl: `${ANYFLIP_URL}101`
  });
});

test("Bothan, Droid, and Sullustan retain cited structured starting talent ranks without automating them", () => {
  const grants = Object.fromEntries(SPECIES.map((species) => [species.id, species.setup.startingTalentRanks ?? []]));
  assert.deepEqual(grants.bothan, [{
    talentId: "convincing-demeanor", rank: 1,
    source: "Age of Rebellion Core Rulebook, p. 52", sourcePage: 52, sourceUrl: `${ANYFLIP_URL}53`
  }]);
  assert.deepEqual(grants.droid, [{
    talentId: "enduring", rank: 1,
    source: "Age of Rebellion Core Rulebook, p. 54", sourcePage: 54, sourceUrl: `${ANYFLIP_URL}55`
  }]);
  assert.deepEqual(grants.sullustan, [{
    talentId: "skilled-jockey", rank: 1,
    source: "Age of Rebellion Core Rulebook, p. 60", sourcePage: 60, sourceUrl: `${ANYFLIP_URL}61`
  }]);
  for (const rankGrant of [grants.bothan[0], grants.droid[0], grants.sullustan[0]]) {
    assert.ok(findTalent(rankGrant.talentId));
    assert.equal(findTalent(rankGrant.talentId)?.npcOnly, false);
  }
});

test("tree validation rejects invalid catalogue references, topology, and explicit requirements", () => {
  const malformed = structuredClone(SPECIALIZATION_TREE_CATALOG);
  malformed.trees[0].nodes[0].id = "r1c1";
  malformed.trees[0].nodes[1].talentId = "adversary";
  malformed.trees[0].connectors.push([...malformed.trees[0].connectors[1]]);
  malformed.trees[0].connectors[2] = [malformed.trees[0].nodes[1].id, malformed.trees[0].nodes[19].id];
  malformed.trees[0].requirements.entryNodeIds.pop();
  malformed.trees[0].source.sourceUrl = "https://invalid.example/";
  const errors = validateSpecializationTreeCatalog(malformed);
  assert.ok(errors.some((error) => error.includes("canonical <specializationGlobalId>:rNcN")));
  assert.ok(errors.some((error) => error.includes("NPC-only talent")));
  assert.ok(errors.some((error) => error.includes("orthogonally adjacent")));
  assert.ok(errors.some((error) => error.includes("Duplicate connector")));
  assert.ok(errors.some((error) => error.includes("complete top-row entry nodes")));
  assert.ok(errors.some((error) => error.includes("every occurrence reachable")));
  assert.ok(errors.some((error) => error.includes("audited printed page and direct AnyFlip URL")));
});
