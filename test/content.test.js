import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEntryId, parseMarkdownSections, splitTrailingCitationLink } from "../src/domain/content.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the current manifests retain all 17 reference cards and files", () => {
  const manifests = ["personnel_manifest.json", "vehicle_manifest.json"].map((file) => JSON.parse(readFileSync(path.join(root, file), "utf8")));
  assert.equal(manifests[0].length, 12);
  assert.equal(manifests[1].length, 5);
  assert.equal(manifests.flat().length, 17);
  manifests.flat().forEach((entry) => assert.equal(existsSync(path.join(root, entry.file)), true, entry.file));
});

test("reference IDs remain stable and unique across both rulesets", () => {
  const entries = ["personnel", "vehicle"].flatMap((ruleset) => JSON.parse(readFileSync(path.join(root, `${ruleset}_manifest.json`), "utf8")).map((entry, index) => createEntryId(ruleset, entry, index)));
  assert.equal(new Set(entries).size, 17);
});

test("markdown parser preserves current top-level headings and bullets", () => {
  const sections = parseMarkdownSections("# Maneuvers\n- Take cover\n- Move\n# Actions\n- Make a check");
  assert.deepEqual(sections, [
    { title: "Maneuvers", items: ["Take cover", "Move"] },
    { title: "Actions", items: ["Make a check"] }
  ]);
});

test("heading citations are split from the clickable accordion button", () => {
  assert.deepEqual(splitTrailingCitationLink("Combat Modifiers ([AoR Core, p. 210](https://example.test))"), {
    title: "Combat Modifiers",
    citation: "([AoR Core, p. 210](https://example.test))"
  });
});
