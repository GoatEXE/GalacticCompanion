#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const allowedInlineTags = [/^<b>$/i, /^<\/b>$/i, /^<br\s*\/?>$/i, /^<\/br>$/i];
let errors = 0;
let warnings = 0;

function report(level, message) {
    if (level === "error") {
        errors += 1;
        console.error(`ERROR: ${message}`);
    } else {
        warnings += 1;
        console.warn(`WARN: ${message}`);
    }
}

function createSafeId(value, suffix = "") {
    const safeValue = String(value).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${safeValue || "item"}${suffix}`;
}

function createEntryId(manifestSubset, entry, index) {
    return createSafeId(`quick-ref-${manifestSubset}-${index}-${entry.file}-${entry.title}`.toLowerCase());
}

function readJsonArray(relativePath) {
    const fullPath = path.join(repoRoot, relativePath);
    let parsed;

    try {
        parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (error) {
        report("error", `${relativePath} does not parse as JSON: ${error.message}`);
        return null;
    }

    if (!Array.isArray(parsed)) {
        report("error", `${relativePath} must contain a JSON array.`);
        return null;
    }

    return parsed;
}

function validateMarkdown(relativePath) {
    const fullPath = path.join(repoRoot, relativePath);
    let text;

    try {
        text = fs.readFileSync(fullPath, "utf8");
    } catch (error) {
        report("error", `${relativePath} could not be read: ${error.message}`);
        return;
    }

    if (!text.split(/\r?\n/).some((line) => line.startsWith("# "))) {
        report("error", `${relativePath} must include at least one top-level "# " section heading.`);
    }

    const seenUnsupportedTags = new Set();
    for (const match of text.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
        const tag = match[0];
        if (!allowedInlineTags.some((pattern) => pattern.test(tag))) {
            seenUnsupportedTags.add(tag);
        }
    }

    if (seenUnsupportedTags.size > 0) {
        report(
            "warn",
            `${relativePath} contains raw HTML not rendered as formatting by Scripts/main.js: ${Array.from(seenUnsupportedTags).join(", ")}`
        );
    }
}

function validateManifest(relativePath, entryIds) {
    const manifest = readJsonArray(relativePath);
    if (!manifest) return;

    const manifestSubset = path.basename(relativePath, "_manifest.json");

    manifest.forEach((entry, index) => {
        const label = `${relativePath}[${index}]`;
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            report("error", `${label} must be an object.`);
            return;
        }

        ["title", "icon", "file"].forEach((field) => {
            if (typeof entry[field] !== "string" || entry[field].trim() === "") {
                report("error", `${label} must include a non-empty string "${field}".`);
            }
        });

        if (typeof entry.file === "string" && entry.file.trim() !== "") {
            const markdownPath = path.join(repoRoot, entry.file);
            if (!fs.existsSync(markdownPath)) {
                report("error", `${label} references missing markdown file: ${entry.file}`);
            } else {
                validateMarkdown(entry.file);
            }
        }

        const entryId = createEntryId(manifestSubset, entry, index);
        if (entryIds.has(entryId)) {
            report("error", `${label} generates duplicate target id "${entryId}" also used by ${entryIds.get(entryId)}.`);
        } else {
            entryIds.set(entryId, label);
        }
    });
}

function main() {
    const manifestFiles = fs.readdirSync(repoRoot)
        .filter((file) => file.endsWith("_manifest.json"))
        .sort();

    if (manifestFiles.length === 0) {
        report("error", "No *_manifest.json files found in the repository root.");
    }

    const entryIds = new Map();
    manifestFiles.forEach((file) => validateManifest(file, entryIds));

    const status = `${manifestFiles.length} manifest(s) checked, ${entryIds.size} quick-reference target id(s) generated, ${warnings} warning(s), ${errors} error(s).`;
    if (errors > 0) {
        console.error(`Content validation failed: ${status}`);
        process.exit(1);
    }

    console.log(`Content validation passed: ${status}`);
}

main();
