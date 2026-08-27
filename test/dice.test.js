import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPool, normalizeResults, simulateRoll } from "../src/domain/dice.js";

test("Triumph supplies one Success and remains a visible special event", () => {
  const result = normalizeResults({ triumph: 1 });
  assert.equal(result.netSuccess, 1);
  assert.equal(result.netFailure, 0);
  assert.equal(result.normalizedResults.success, 1);
  assert.equal(result.normalizedResults.triumph, 1);
});

test("Despair supplies one Failure and remains a visible special event", () => {
  const result = normalizeResults({ despair: 1 });
  assert.equal(result.netSuccess, 0);
  assert.equal(result.netFailure, 1);
  assert.equal(result.normalizedResults.failure, 1);
  assert.equal(result.normalizedResults.despair, 1);
});

test("Success and Failure cancel one-for-one while Triumph and Despair do not disappear", () => {
  const result = normalizeResults({ success: 1, failure: 1, triumph: 1, despair: 1, advantage: 2, threat: 2 });
  assert.equal(result.netSuccess, 0);
  assert.equal(result.netFailure, 0);
  assert.equal(result.normalizedResults.triumph, 1);
  assert.equal(result.normalizedResults.despair, 1);
  assert.equal(result.normalizedResults.advantage, 0);
  assert.equal(result.normalizedResults.threat, 0);
});

test("the high face of proficiency and challenge dice yields Triumph and Despair", () => {
  const pool = createEmptyPool();
  pool.proficiency = 1;
  pool.challenge = 1;
  const raw = simulateRoll(pool, () => 0.9999);
  assert.deepEqual(raw, { success: 0, advantage: 0, triumph: 1, despair: 1, failure: 0, threat: 0 });
});
