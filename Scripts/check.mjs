import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "src/main.jsx",
  "src/app/App.jsx",
  "src/shell/DossierShell.jsx",
  "src/shell/CharacterDialog.jsx",
  "src/reference/ReferencePanel.jsx",
  "src/dice/DiceRoller.jsx",
  "src/domain/content.js",
  "src/domain/dice.js",
  "src/domain/backgrounds.js",
  "src/companion/catalog.js",
  "src/companion/schema.js",
  "src/companion/calculations.js",
  "src/companion/persistence.js",
  "src/companion/CharacterCreator.jsx",
  "src/companion/CharacterSheet.jsx",
  "src/styles/dossier.css",
  "src/styles/companion.css",
  "vite.config.js"
];

const missingFiles = requiredFiles.filter((file) => !existsSync(path.join(root, file)));
if (missingFiles.length) throw new Error(`Missing companion foundation files: ${missingFiles.join(", ")}`);

const indexHtml = readFileSync(path.join(root, "index.html"), "utf8");
if (!indexHtml.includes("href=\"Resources/brand-rebel-svgrepo-com.svg\"")) {
  throw new Error("index.html must use a base-relative static favicon path.");
}

execFileSync(process.execPath, ["tools/validate-content.js"], { cwd: root, stdio: "inherit" });
console.log("Foundation check passed: shell, reference, dice, companion modules, and content validation are present.");
