import { createRoster, migrateCharacter, migrateRoster, touch } from "./schema.js";

export const COMPANION_STORAGE_KEY = "aor-companion-roster";

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function loadRoster(storage = browserStorage()) {
  if (!storage) return { roster: createRoster(), error: "Local storage is unavailable; changes will only last for this session." };
  try {
    const raw = storage.getItem(COMPANION_STORAGE_KEY);
    if (!raw) return { roster: createRoster(), error: null };
    return { roster: migrateRoster(JSON.parse(raw)), error: null };
  } catch {
    return { roster: createRoster(), error: "Saved character data could not be read. A new local roster was opened." };
  }
}

export function saveRoster(roster, storage = browserStorage()) {
  const normalized = migrateRoster(roster);
  if (!storage) return { roster: normalized, error: "Local storage is unavailable; changes will only last for this session." };
  try {
    storage.setItem(COMPANION_STORAGE_KEY, JSON.stringify(normalized));
    return { roster: normalized, error: null };
  } catch {
    return { roster: normalized, error: "Could not save to local storage. Export a JSON backup before closing this page." };
  }
}

export function upsertCharacter(roster, character) {
  const saved = touch(migrateCharacter(character));
  const index = roster.characters.findIndex((entry) => entry.id === saved.id);
  const characters = index === -1
    ? [...roster.characters, saved]
    : roster.characters.map((entry) => entry.id === saved.id ? saved : entry);
  return { ...roster, characters, activeCharacterId: saved.id };
}

export function deleteCharacter(roster, characterId) {
  const characters = roster.characters.filter((entry) => entry.id !== characterId);
  return { ...roster, characters, activeCharacterId: roster.activeCharacterId === characterId ? (characters[0]?.id ?? null) : roster.activeCharacterId };
}

export function addImportedCharacter(roster, character) {
  const imported = migrateCharacter(character);
  const duplicate = roster.characters.some((entry) => entry.id === imported.id);
  const copy = duplicate ? { ...imported, id: `${imported.id}-copy-${Date.now().toString(36)}`, name: `${imported.name} (imported)` } : imported;
  return upsertCharacter(roster, copy);
}
