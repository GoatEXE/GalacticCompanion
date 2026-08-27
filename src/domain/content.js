const manifestCache = new Map();
const sectionCache = new Map();

export function contentUrl(relativePath) {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

export function createSafeId(value, suffix = "") {
  const safeValue = String(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeValue || "item"}${suffix}`;
}

export function createEntryId(ruleset, entry, index) {
  return createSafeId(`quick-ref-${ruleset}-${index}-${entry.file}-${entry.title}`.toLowerCase());
}

export function parseMarkdownSections(markdown) {
  const sections = [];
  let currentSection = null;

  for (const line of String(markdown).split(/\r?\n/)) {
    if (line.startsWith("# ")) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: line.slice(2).trim(), items: [] };
    } else if (line.startsWith("- ") && currentSection) {
      currentSection.items.push(line.slice(2).trim());
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

export function splitTrailingCitationLink(value) {
  const match = String(value).match(/^(.*?)(\s*\(\[[^\]\n]+\]\([^\s)]+\)\))\s*$/);
  if (!match) return { title: String(value), citation: null };
  return { title: match[1].trim(), citation: match[2].trim() };
}

export function parseInlineTokens(value) {
  return String(value)
    .split(/(<\/?b>|<\/?br\s*\/?>|\[[^\]\n]+\]\([^\s)]+\))/gi)
    .filter((token) => token !== "")
    .map((token) => {
      const lowerToken = token.toLowerCase();
      const markdownLink = token.match(/^\[([^\]\n]+)\]\(([^\s)]+)\)$/);
      if (lowerToken === "<b>") return { type: "strong-open" };
      if (lowerToken === "</b>") return { type: "strong-close" };
      if (["<br>", "<br/>", "<br />", "</br>"].includes(lowerToken)) return { type: "break" };
      if (markdownLink) {
        try {
          const url = new URL(markdownLink[2]);
          if (url.protocol === "http:" || url.protocol === "https:") {
            return { type: "link", label: markdownLink[1], href: url.href };
          }
        } catch {
          // Unsupported URLs are rendered as text below.
        }
      }
      return { type: "text", value: token };
    });
}

async function fetchContent(relativePath, parser) {
  const response = await fetch(contentUrl(relativePath));
  if (!response.ok) throw new Error(`Unable to load ${relativePath} (${response.status}).`);
  return parser(response);
}

export function getManifest(ruleset) {
  if (!manifestCache.has(ruleset)) {
    const request = fetchContent(`${ruleset}_manifest.json`, (response) => response.json())
      .catch((error) => {
        manifestCache.delete(ruleset);
        throw error;
      });
    manifestCache.set(ruleset, request);
  }
  return manifestCache.get(ruleset);
}

export function getSections(ruleset, entry) {
  const cacheKey = `${ruleset}:${entry.file}`;
  if (!sectionCache.has(cacheKey)) {
    const request = fetchContent(entry.file, (response) => response.text())
      .then(parseMarkdownSections)
      .catch((error) => {
        sectionCache.delete(cacheKey);
        throw error;
      });
    sectionCache.set(cacheKey, request);
  }
  return sectionCache.get(cacheKey);
}

export async function loadRuleset(ruleset) {
  const manifest = await getManifest(ruleset);
  if (!Array.isArray(manifest)) throw new Error("The ruleset manifest must contain an array.");

  return Promise.all(manifest.map(async (entry, index) => ({
    entry,
    entryId: createEntryId(ruleset, entry, index),
    sections: await getSections(ruleset, entry)
  })));
}
