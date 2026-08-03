const manifestCache = new Map();
const sectionsCache = new Map();
const BACKGROUND_STORAGE_KEY = "aor-selected-background";
const DEFAULT_BACKGROUND = "Resources/Pursuit.jpg";
let latestRenderToken = 0;

function createSafeId(value, suffix = "") {
    const safeValue = String(value).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${safeValue || "item"}${suffix}`;
}

function createEntryId(manifestSubset, entry, index) {
    return createSafeId(`quick-ref-${manifestSubset}-${index}-${entry.file}-${entry.title}`.toLowerCase());
}

function setRulesBusy(rulesReferenceSection, isBusy) {
    rulesReferenceSection.setAttribute("aria-busy", String(isBusy));
}

function createStatusColumn(message, alertClass = "alert-info", role = "status") {
    const statusCol = document.createElement("div");
    statusCol.className = "col-12";

    const alert = document.createElement("div");
    alert.className = `alert ${alertClass}`;
    alert.setAttribute("role", role);
    alert.textContent = message;

    statusCol.appendChild(alert);
    return statusCol;
}

function createMenuStatusItem(message) {
    const menuItem = document.createElement("li");
    const statusItem = document.createElement("span");
    statusItem.className = "dropdown-item disabled";
    statusItem.setAttribute("aria-disabled", "true");
    statusItem.textContent = message;
    menuItem.appendChild(statusItem);
    return menuItem;
}

function setMenuStatus(menu, message) {
    if (!menu) return;
    menu.replaceChildren(createMenuStatusItem(message));
}

function showRulesLoading(rulesReferenceSection, menu) {
    setRulesBusy(rulesReferenceSection, true);

    const loadingCol = document.createElement("div");
    loadingCol.className = "col-12 text-center";

    const loadingStatus = document.createElement("div");
    loadingStatus.className = "d-inline-flex align-items-center gap-2";
    loadingStatus.setAttribute("role", "status");

    const spinner = document.createElement("span");
    spinner.className = "spinner-border spinner-border-sm";
    spinner.setAttribute("aria-hidden", "true");

    const message = document.createElement("span");
    message.textContent = "Loading quick reference…";

    loadingStatus.append(spinner, message);
    loadingCol.appendChild(loadingStatus);

    rulesReferenceSection.replaceChildren(loadingCol);
    setMenuStatus(menu, "Loading quick reference…");
}

function showRulesError(message, renderToken) {
    if (renderToken !== latestRenderToken) return;

    const rulesReferenceSection = document.getElementById("rulesCardContainer") || document.getElementById("rules-reference")?.querySelector(".row");
    const menu = document.getElementById("quickRef");
    if (!rulesReferenceSection) return;

    rulesReferenceSection.replaceChildren(createStatusColumn(message, "alert-danger", "alert"));
    setMenuStatus(menu, "Quick reference unavailable");
    setRulesBusy(rulesReferenceSection, false);
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to load ${url} (${response.status})`);
    }
    return response.json();
}

async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to load ${url} (${response.status})`);
    }
    return response.text();
}

async function getManifest(manifestSubset) {
    if (!manifestCache.has(manifestSubset)) {
        const manifestPromise = fetchJson(`${manifestSubset}_manifest.json`).catch((error) => {
            manifestCache.delete(manifestSubset);
            throw error;
        });
        manifestCache.set(manifestSubset, manifestPromise);
    }
    return manifestCache.get(manifestSubset);
}

function parseMarkdownSections(mdText) {
    const sections = [];
    const lines = mdText.split("\n");
    let currentSection = null;

    for (const line of lines) {
        if (line.startsWith("# ")) {
            if (currentSection) {
                sections.push(currentSection);
            }
            currentSection = {
                title: line.replace("# ", "").trim(),
                items: []
            };
        } else if (line.startsWith("- ") && currentSection) {
            currentSection.items.push(line.slice(2).trim());
        }
    }

    if (currentSection) {
        sections.push(currentSection);
    }

    return sections;
}

async function getSections(manifestSubset, entry) {
    const cacheKey = `${manifestSubset}:${entry.file}`;
    if (!sectionsCache.has(cacheKey)) {
        const sectionsPromise = fetchText(entry.file)
            .then(parseMarkdownSections)
            .catch((error) => {
                sectionsCache.delete(cacheKey);
                throw error;
            });
        sectionsCache.set(cacheKey, sectionsPromise);
    }
    return sectionsCache.get(cacheKey);
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-ruleset]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            renderCards(link.dataset.ruleset);
        });
    });

    restoreBackgroundSelection();

    document.querySelectorAll("[data-background]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            changeBackground(link.dataset.background);
        });
    });

    document.querySelectorAll("[data-scroll-target]").forEach((button) => {
        button.addEventListener("click", () => scrollToSection(button.dataset.scrollTarget));
    });

    renderCards("personnel");
});

async function renderCards(manifestSubset) {
    const renderToken = ++latestRenderToken;
    const rulesReferenceSection = document.getElementById("rulesCardContainer") || document.getElementById("rules-reference").querySelector(".row");
    const menu = document.getElementById("quickRef");

    if (!rulesReferenceSection || !menu) return;

    showRulesLoading(rulesReferenceSection, menu);

    try {
        const manifest = await getManifest(manifestSubset);

        if (renderToken !== latestRenderToken) return;

        if (!Array.isArray(manifest) || manifest.length === 0) {
            rulesReferenceSection.replaceChildren(createStatusColumn("No quick reference entries are available for this ruleset."));
            setMenuStatus(menu, "No quick reference entries");
            setRulesBusy(rulesReferenceSection, false);
            return;
        }

        const entriesWithSections = await Promise.all(
            manifest.map(async (entry, index) => ({
                entry,
                entryId: createEntryId(manifestSubset, entry, index),
                sections: await getSections(manifestSubset, entry)
            }))
        );

        if (renderToken !== latestRenderToken) return;

        const cardsFragment = document.createDocumentFragment();
        const menuFragment = document.createDocumentFragment();

        entriesWithSections.forEach(({ entry, entryId, sections }) => {
            cardsFragment.appendChild(createCard(entry, entryId, sections));
            menuFragment.appendChild(createMenuItem(entry, entryId));
        });

        rulesReferenceSection.replaceChildren(cardsFragment);
        menu.replaceChildren(menuFragment);
        setRulesBusy(rulesReferenceSection, false);

        if (!prefersReducedMotion()) {
            // Animation delay
            rulesReferenceSection.querySelectorAll(".flicker-in-1").forEach((el) => {
                const randomDelay = (Math.random() * .7).toFixed(2) + "s"; // Up to 0.7s delay
                el.style.animationDelay = randomDelay;
            });
        }

        handleQuickReferenceHash(entriesWithSections.map(({ entryId }) => entryId));
    } catch (error) {
        console.error(error);
        showRulesError("The quick reference could not be loaded. Please refresh the page or try another ruleset.", renderToken);
    }
}

function createCard(entry, entryId, sections) {
    const cardCol = document.createElement("div");
    cardCol.className = "col-lg-6 col-md-12 mb-4";

    const card = document.createElement("div");
    card.className = "card h-100";

    // Create a unique collapse ID for this card's body
    const collapseId = `${entryId}-collapse`;

    const cardHeader = document.createElement("button");
    cardHeader.className = "card-header card-header-toggle flicker-in-1";
    cardHeader.type = "button";
    cardHeader.id = entryId;
    cardHeader.setAttribute("data-bs-toggle", "collapse");
    cardHeader.setAttribute("data-bs-target", `#${collapseId}`);
    cardHeader.setAttribute("aria-expanded", "false");
    cardHeader.setAttribute("aria-controls", collapseId);

    const icon = document.createElement("i");
    icon.className = entry.icon;

    cardHeader.appendChild(icon);
    cardHeader.append(` ${entry.title}`);

    const cardBodyWrapper = document.createElement("div");
    cardBodyWrapper.className = "collapse";
    cardBodyWrapper.id = collapseId;
    cardBodyWrapper.setAttribute("aria-labelledby", entryId);

    const cardBody = document.createElement("div");
    cardBody.className = "card-body";

    // Accordion stays inside card body
    const accordionId = `${entryId}-accordion`;
    const accordion = document.createElement("div");
    accordion.className = "accordion";
    accordion.id = accordionId;

    if (sections.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "mb-0 text-body-secondary";
        emptyMessage.textContent = "No quick reference details are available for this card yet.";
        cardBody.appendChild(emptyMessage);
    } else {
        // Add accordion items
        sections.forEach((section, index) => {
            accordion.appendChild(createAccordionItem(accordionId, section, index));
        });

        cardBody.appendChild(accordion);
    }
    cardBodyWrapper.appendChild(cardBody);

    card.appendChild(cardHeader);
    card.appendChild(cardBodyWrapper);
    cardCol.appendChild(card);

    return cardCol;
}

function createSafeMarkdownLink(label, href) {
    let parsedUrl;
    try {
        parsedUrl = new URL(href);
    } catch (error) {
        return null;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return null;
    }

    const link = document.createElement("a");
    link.href = parsedUrl.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
}

function appendSafeInlineContent(parent, value) {
    const parts = String(value).split(/(<\/?b>|<\/?br\s*\/?>|\[[^\]\n]+\]\([^\s)]+\))/gi);
    const strongStack = [];
    let currentParent = parent;

    parts.forEach((part) => {
        const token = part.toLowerCase();
        const markdownLink = part.match(/^\[([^\]\n]+)\]\(([^\s)]+)\)$/);

        if (token === "<b>") {
            const strong = document.createElement("strong");
            currentParent.appendChild(strong);
            strongStack.push(currentParent);
            currentParent = strong;
        } else if (token === "</b>") {
            currentParent = strongStack.pop() || parent;
        } else if (token === "<br>" || token === "<br/>" || token === "<br />" || token === "</br>") {
            currentParent.appendChild(document.createElement("br"));
        } else if (markdownLink) {
            const link = createSafeMarkdownLink(markdownLink[1], markdownLink[2]);
            currentParent.appendChild(link || document.createTextNode(part));
        } else if (part) {
            currentParent.append(part);
        }
    });
}

function splitTrailingCitationLink(value) {
    const match = String(value).match(/^(.*?)(\s*\(\[[^\]\n]+\]\([^\s)]+\)\))\s*$/);
    if (!match) return { title: String(value), citation: null };

    return {
        title: match[1].trim(),
        citation: match[2].trim()
    };
}

function createAccordionItem(accordionId, section, index) {
    const sectionId = `${accordionId}-section${index}`;
    const buttonId = `${sectionId}-button`;

    const item = document.createElement("div");
    item.className = "accordion-item";

    const header = document.createElement("h2");
    header.className = "accordion-header";

    const headingContent = splitTrailingCitationLink(section.title);

    const button = document.createElement("button");
    button.className = "accordion-button collapsed";
    button.type = "button";
    button.id = buttonId;
    button.setAttribute("data-bs-toggle", "collapse");
    button.setAttribute("data-bs-target", `#${sectionId}`);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", sectionId);
    button.textContent = headingContent.title;

    header.appendChild(button);

    if (headingContent.citation) {
        const citation = document.createElement("span");
        citation.className = "accordion-heading-citation";
        appendSafeInlineContent(citation, headingContent.citation);
        header.appendChild(citation);
    }

    const collapse = document.createElement("div");
    collapse.id = sectionId;
    collapse.className = "accordion-collapse collapse";
    collapse.setAttribute("aria-labelledby", buttonId);
    collapse.setAttribute("data-bs-parent", `#${accordionId}`);

    const body = document.createElement("div");
    body.className = "accordion-body";

    const list = document.createElement("ul");
    section.items.forEach((sectionItem) => {
        const listItem = document.createElement("li");
        appendSafeInlineContent(listItem, sectionItem);
        list.appendChild(listItem);
    });

    body.appendChild(list);
    collapse.appendChild(body);
    item.appendChild(header);
    item.appendChild(collapse);

    return item;
}

function createMenuItem(entry, entryId) {
    const menuItem = document.createElement("li");
    const link = document.createElement("a");
    link.className = "dropdown-item";
    link.href = `#${entryId}`;
    link.textContent = entry.title;
    link.addEventListener("click", (e) => {
        e.preventDefault();
        scrollToSection(entryId);
    });
    menuItem.appendChild(link);
    return menuItem;
}

function getBackgroundOptions() {
    return Array.from(document.querySelectorAll("[data-background]"));
}

function getKnownBackgrounds() {
    return new Set(getBackgroundOptions().map((option) => option.dataset.background));
}

function getStoredBackground() {
    try {
        return window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
    } catch (error) {
        return null;
    }
}

function setStoredBackground(imageURL) {
    try {
        window.localStorage.setItem(BACKGROUND_STORAGE_KEY, imageURL);
    } catch (error) {
        // Ignore storage failures so background selection still works in private or locked-down contexts.
    }
}

function removeStoredBackground() {
    try {
        window.localStorage.removeItem(BACKGROUND_STORAGE_KEY);
    } catch (error) {
        // Ignore storage failures.
    }
}

function updateBackgroundSelection(imageURL) {
    getBackgroundOptions().forEach((option) => {
        const isSelected = option.dataset.background === imageURL;
        option.classList.toggle("active", isSelected);
        option.setAttribute("aria-pressed", String(isSelected));
    });
}

function restoreBackgroundSelection() {
    const knownBackgrounds = getKnownBackgrounds();
    const storedBackground = getStoredBackground();
    const backgroundToUse = knownBackgrounds.has(storedBackground) ? storedBackground : DEFAULT_BACKGROUND;

    if (storedBackground && !knownBackgrounds.has(storedBackground)) {
        removeStoredBackground();
    }

    changeBackground(backgroundToUse, { persist: false });
}

function changeBackground(imageURL, { persist = true } = {}) {
    if (!getKnownBackgrounds().has(imageURL)) return false;

    const resolvedImageUrl = new URL(imageURL, document.baseURI).href;
    document.documentElement.style.setProperty("--bg-image", `url("${resolvedImageUrl}")`);
    updateBackgroundSelection(imageURL);

    if (persist) {
        setStoredBackground(imageURL);
    }

    return true;
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function handleQuickReferenceHash(entryIds) {
    if (!location.hash || location.hash.length <= 1) return;

    let hashTarget;
    try {
        hashTarget = decodeURIComponent(location.hash.slice(1));
    } catch (error) {
        hashTarget = location.hash.slice(1);
    }

    if (!entryIds.includes(hashTarget)) return;

    scrollToSection(hashTarget);

    const target = document.getElementById(hashTarget);
    if (target) {
        target.focus({ preventScroll: true });
    }
}

// Smooth scrolling function
function scrollToSection(sectionId) {
    const yOffset = -250; // Adjust to match your navbar height
    const element = document.getElementById(sectionId);
    if (!element) return;

    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: prefersReducedMotion() ? "auto" : "smooth" });

    // Collapse the navbar if it's open (mobile)
    const navbarCollapse = document.querySelector(".navbar-collapse.show");
    if (navbarCollapse) {
        const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse) || new bootstrap.Collapse(navbarCollapse, { toggle: false });
        bsCollapse.hide();
    }

    // Collapse any open dropdowns
    const dropdown = document.querySelector(".nav-item.dropdown.show");
    if (dropdown) {
        const dropdownToggle = dropdown.querySelector('[data-bs-toggle="dropdown"]');
        if (dropdownToggle) {
            dropdownToggle.click(); // Bootstrap handles toggling
        }
    }
}
