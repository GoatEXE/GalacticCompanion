import React, { useEffect, useRef, useState } from "react";
import { contentUrl } from "../domain/content.js";
import { CharacterCreator } from "../companion/CharacterCreator.jsx";
import { CharacterSheet } from "../companion/CharacterSheet.jsx";
import { deriveCharacter } from "../companion/calculations.js";
import { createCharacter, exportCharacter, parseCharacterImport } from "../companion/schema.js";
import { addImportedCharacter, deleteCharacter, loadRoster, saveRoster, upsertCharacter } from "../companion/persistence.js";

const archiveSheets = [
  ["B1-3B4", "Soldier", "B1 Battle Droid"], ["B1-OOM-69", "Commander", "B1 Battle Droid"], ["B2-4TY", "Ace", "B2 Super Battle Droid"],
  ["IG-96", "Spy", "IG Assassin Droid"], ["MSE-6B9", "Engineer", "Mouse Droid"], ["R5-B8", "Ace", "R5 Astromech Droid"], ["TC-42", "Diplomat", "TC Protocol Droid"]
];

function downloadCharacter(character) {
  const blob = new Blob([exportCharacter(character)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${character.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "operative"}.aor-character.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function CharacterDialog({ open, onClose }) {
  const dialog = useRef(null);
  const importInput = useRef(null);
  const [{ roster: initialRoster, error: initialError }] = useState(() => loadRoster());
  const [roster, setRoster] = useState(initialRoster);
  const [storageError, setStorageError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("dashboard");
  const active = roster.characters.find((character) => character.id === roster.activeCharacterId) ?? null;

  useEffect(() => {
    if (!dialog.current) return;
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);

  const commit = (nextRoster) => {
    const result = saveRoster(nextRoster);
    setRoster(result.roster);
    setStorageError(result.error);
  };
  const editCharacter = (character) => commit({ ...roster, activeCharacterId: character.id });
  const create = () => {
    const character = createCharacter();
    commit(upsertCharacter(roster, character));
    setMode("creator");
    setNotice("New local personnel file created.");
  };
  const updateActive = (character) => commit(upsertCharacter(roster, character));
  const remove = (character) => {
    if (!window.confirm(`Delete ${character.name}? This only removes its local browser copy.`)) return;
    commit(deleteCharacter(roster, character.id));
    setMode("dashboard");
    setNotice("Local personnel file deleted.");
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const character = parseCharacterImport(await file.text());
      commit(addImportedCharacter(roster, character));
      setMode("creator");
      setNotice(`Imported ${character.name}.`);
    } catch (error) {
      setNotice(`Import rejected: ${error.message}`);
    }
  };

  return <dialog ref={dialog} className="character-dialog companion-dialog" aria-labelledby="character-dialog-title" onClose={onClose}>
    <div className="modal-header"><div><p className="dossier-kicker">Alliance archive // local companion</p><h2 id="character-dialog-title">Personnel files</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close character companion">×</button></div>
    <div className="companion-toolbar"><button className="button button-primary" type="button" onClick={create}>New character</button><button className="button button-secondary" type="button" onClick={() => importInput.current?.click()}>Import JSON</button><input ref={importInput} className="sr-only" type="file" accept="application/json,.json" onChange={importFile} />{active && <button className="button button-secondary" type="button" onClick={() => downloadCharacter(active)}>Export active</button>}{mode !== "dashboard" && <button className="button button-secondary" type="button" onClick={() => setMode("dashboard")}>All files</button>}</div>
    {(storageError || notice) && <p className={storageError ? "companion-notice error" : "companion-notice"} role="status">{storageError || notice}</p>}
    <div className="modal-body companion-body">
      {mode === "dashboard" && <section aria-labelledby="roster-title"><div className="dashboard-heading"><div><h3 id="roster-title">Local roster</h3><p>Characters are stored in this browser. Export JSON to move or back up a file.</p></div><span>{roster.characters.length} file{roster.characters.length === 1 ? "" : "s"}</span></div>{!roster.characters.length ? <div className="empty-state large"><h4>No local personnel files</h4><p>Create a character or import a previously exported file. No account or network connection is used.</p><button className="button button-primary" type="button" onClick={create}>Create first character</button></div> : <div className="character-roster">{roster.characters.map((character) => { const derived = deriveCharacter(character); return <article key={character.id} className={character.id === roster.activeCharacterId ? "roster-card active" : "roster-card"}><div><p className="dossier-kicker">{derived.isPlayable ? "Ready for field use" : "Draft"}</p><h4>{character.name}</h4><p>{derived.species?.name ?? "Species pending"} · {derived.isPlayable ? "Playable" : `${derived.errors.length} file check${derived.errors.length === 1 ? "" : "s"}`}</p></div><div className="roster-actions"><button className="button button-secondary" type="button" onClick={() => { editCharacter(character); setMode("creator"); }}>Edit</button><button className="button button-secondary" type="button" onClick={() => { editCharacter(character); setMode("sheet"); }} disabled={!derived.isPlayable}>Sheet</button><button className="icon-button" type="button" aria-label={`Delete ${character.name}`} onClick={() => remove(character)}>×</button></div></article>; })}</div>}</section>}
      {mode === "creator" && active && <CharacterCreator character={active} onChange={updateActive} onOpenSheet={() => setMode("sheet")} />}
      {mode === "sheet" && active && <CharacterSheet character={active} onChange={updateActive} onEdit={() => setMode("creator")} />}
      <details className="archive-sheets"><summary>Legacy PDF character sheets</summary><ul>{archiveSheets.map(([name, career, sheet]) => <li key={name}><a href={contentUrl(`Resources/Character Sheets/${name}.pdf`)} target="_blank" rel="noopener noreferrer">{sheet}</a> <span>{career}</span></li>)}</ul></details>
    </div>
    <div className="modal-footer"><p>Starter data is concise and source-reviewable; use the Core Rulebook with your GM for anything not represented.</p><button className="button button-secondary" type="button" onClick={onClose}>Close</button></div>
  </dialog>;
}
