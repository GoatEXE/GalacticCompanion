import React, { useEffect, useRef, useState } from "react";
import { DiceModal } from "../dice/DiceModal.jsx";
import { ReferencePanel } from "../reference/ReferencePanel.jsx";
import { createCharacter, exportCharacter, parseCharacterImport } from "../companion/schema.js";
import { addImportedCharacter, deleteCharacter, loadRoster, saveRoster, upsertCharacter } from "../companion/persistence.js";
import { CreateView, DossierHome, SheetView } from "../shell/CompanionViews.jsx";
import { DossierShell } from "../shell/DossierShell.jsx";

const VIEWS = new Set(["dossier", "create", "sheet", "rules"]);
const LEGACY_RULES_TARGETS = new Set(["rules-reference"]);
const LEGACY_DICE_TARGETS = new Set(["dice-roller"]);

function hashTarget(hash = "") {
  const value = String(hash).replace(/^#\/?/, "");
  try { return decodeURIComponent(value).toLowerCase(); } catch { return value.toLowerCase(); }
}

export function routeFromHash(hash = "") {
  const target = hashTarget(hash);
  const view = target.split("/")[0];
  if (VIEWS.has(view)) return { view, scrollTarget: null };
  if (LEGACY_DICE_TARGETS.has(target)) return { view: "dossier", scrollTarget: null, diceModal: true };
  if (LEGACY_RULES_TARGETS.has(target) || target.startsWith("quick-ref-")) return { view: "rules", scrollTarget: target };
  return { view: "dossier", scrollTarget: null };
}

export function viewFromHash(hash = "") {
  return routeFromHash(hash).view;
}

function activeCharacter(roster) {
  return roster.characters.find((character) => character.id === roster.activeCharacterId) ?? null;
}

export function initializeAppState(hash, storage) {
  const loaded = loadRoster(storage);
  const route = routeFromHash(hash);
  if (route.view !== "create" || activeCharacter(loaded.roster)) return { ...loaded, route };

  const saved = saveRoster(upsertCharacter(loaded.roster, createCharacter()), storage);
  return { roster: saved.roster, error: saved.error ?? loaded.error, route };
}

function currentHash() {
  return typeof window === "undefined" ? "" : window.location.hash;
}

function downloadCharacter(character) {
  const blob = new Blob([exportCharacter(character)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${character.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "operative"}.aor-character.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [initialState] = useState(() => initializeAppState(currentHash()));
  const [roster, setRoster] = useState(initialState.roster);
  const [storageError, setStorageError] = useState(initialState.error);
  const [notice, setNotice] = useState("");
  const [route, setRoute] = useState(initialState.route);
  const importInput = useRef(null);
  const creatingDraft = useRef(false);
  const diceWasOpen = useRef(Boolean(initialState.route.diceModal));
  const view = route.view;
  const active = activeCharacter(roster);

  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash(currentHash()));
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    if (!route.scrollTarget || view !== "rules") return undefined;
    const timeout = window.setTimeout(() => document.getElementById(route.scrollTarget)?.scrollIntoView({ block: "start" }), 100);
    return () => window.clearTimeout(timeout);
  }, [route, view]);

  useEffect(() => {
    const diceOpen = route.diceModal === true;
    if (diceWasOpen.current && !diceOpen) {
      const trigger = document.querySelector('[aria-controls="dice-roller"]');
      if (trigger instanceof HTMLElement) window.setTimeout(() => trigger.focus(), 0);
    }
    diceWasOpen.current = diceOpen;
  }, [route.diceModal]);

  useEffect(() => {
    if (active) creatingDraft.current = false;
  }, [active]);

  useEffect(() => {
    if (!notice && !storageError) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice, storageError]);

  const commit = (nextRoster) => {
    const result = saveRoster(nextRoster);
    setRoster(result.roster);
    setStorageError(result.error);
  };

  const navigate = (nextView, scrollTarget) => {
    if (typeof window === "undefined") return;
    const hash = `#${scrollTarget || nextView}`;
    if (window.location.hash === hash) setRoute(routeFromHash(hash));
    else window.location.hash = hash;
  };

  const create = () => {
    const character = createCharacter();
    commit(upsertCharacter(roster, character));
    setNotice("New local personnel file created.");
    navigate("create");
  };

  useEffect(() => {
    if (view !== "create" || active || creatingDraft.current) return;
    creatingDraft.current = true;
    const character = createCharacter();
    commit(upsertCharacter(roster, character));
    setNotice("New local personnel file created.");
  }, [view, active]);

  const openView = (nextView) => {
    if (nextView === "create" && !active) {
      create();
      return;
    }
    navigate(nextView);
  };

  const openDice = () => navigate("dossier", "dice-roller");
  const closeDice = () => navigate("dossier");
  const updateActive = (character) => commit(upsertCharacter(roster, character));
  const removeActive = () => {
    if (!active || !window.confirm(`Delete ${active.name}? This only removes its local browser copy.`)) return;
    commit(deleteCharacter(roster, active.id));
    setNotice("Local personnel file deleted.");
    navigate("dossier");
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const character = parseCharacterImport(await file.text());
      commit(addImportedCharacter(roster, character));
      setNotice(`Imported ${character.name}.`);
      navigate("create");
    } catch (error) {
      setNotice(`Import rejected: ${error.message}`);
    }
  };

  const content = view === "dossier"
    ? <>
        <DossierHome roster={roster} active={active} onCreate={create} onEdit={() => navigate("create")} onDelete={removeActive} onOpenSheet={() => navigate("sheet")} onOpenRules={() => navigate("rules")} onOpenDice={openDice} onSelectCharacter={(id) => commit({ ...roster, activeCharacterId: id })} diceOpen={route.diceModal === true} />
        <DiceModal open={route.diceModal === true} onClose={closeDice} />
      </>
    : view === "create"
      ? <CreateView active={active} onChange={updateActive} onOpenSheet={() => navigate("sheet")} />
      : view === "sheet"
        ? <SheetView active={active} onCreate={create} onEdit={() => navigate("create")} onChange={updateActive} />
        : <main className="rules-view" id="main-content"><ReferencePanel /></main>;

  return (
    <DossierShell
      view={view}
      onNavigate={openView}
      onImport={() => importInput.current?.click()}
      onExport={() => active && downloadCharacter(active)}
      canExport={Boolean(active)}
    >
      <input ref={importInput} className="sr-only" type="file" accept="application/json,.json" onChange={importFile} />
      {(storageError || notice) && <p className={storageError ? "app-notice error" : "app-notice"} role="status">{storageError || notice}</p>}
      {content}
    </DossierShell>
  );
}
