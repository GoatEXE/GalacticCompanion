import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import viteConfig from "../vite.config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRootFile = (file) => readFileSync(path.join(root, file), "utf8");

test("Galactic Companion identity and Pages base stay aligned", () => {
  const indexHtml = readRootFile("index.html");
  const packageJson = JSON.parse(readRootFile("package.json"));
  const packageLock = JSON.parse(readRootFile("package-lock.json"));
  const readme = readRootFile("README.md");
  const workflow = readRootFile(".github/workflows/deploy-pages.yml");

  assert.match(indexHtml, /<title>Galactic Companion \| Star Wars: Age of Rebellion<\/title>/);
  assert.match(indexHtml, /<meta name="description" content="Galactic Companion is a quick-reference and dice roller for Star Wars: Age of Rebellion\." \/>/);
  assert.doesNotMatch(indexHtml, /Rebel Dossier/);
  assert.equal(packageJson.name, "galactic-companion");
  assert.equal(packageLock.name, "galactic-companion");
  assert.equal(packageLock.packages[""].name, "galactic-companion");
  assert.equal(viteConfig.base, "/GalacticCompanion/");
  assert.match(readme, /`\/GalacticCompanion\/`/);
  assert.match(workflow, /path:\s*dist/);
});
