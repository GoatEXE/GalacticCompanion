import React from "react";
import { deriveCharacter } from "../companion/calculations.js";
import { findCareer, findSpecialization } from "../companion/catalog.js";
import { CharacterCreator } from "../companion/CharacterCreator.jsx";
import { CharacterSheet } from "../companion/CharacterSheet.jsx";
import { LegacySheetArchive } from "../companion/LegacySheetArchive.jsx";

function Icon({ className }) {
  return <i className={className} aria-hidden="true" />;
}

function ViewHeading({ title, children }) {
  return <div className="view-heading">
    <h1>{title}</h1>
    <p className="dossier-kicker">{children}</p>
  </div>;
}

function EntryCard({ icon, tone, title, children, onClick, modalOpen = false }) {
  const modalTrigger = title === "Dice Pool";
  return <button className="dossier-entry-card" type="button" onClick={onClick} aria-controls={modalTrigger ? "dice-roller" : undefined} aria-expanded={modalTrigger ? modalOpen : undefined} aria-haspopup={modalTrigger ? "dialog" : undefined}>
    <Icon className={`${icon} ${tone}`} />
    <span><strong>{title}</strong><small>{children}</small></span>
  </button>;
}

export function DossierHome({ roster, active, onCreate, onEdit, onDelete, onOpenSheet, onOpenRules, onOpenDice, onSelectCharacter, diceOpen = false }) {
  const derived = active ? deriveCharacter(active) : null;
  const career = active ? findCareer(active.careerId) : null;
  const specialization = active ? findSpecialization(active.careerId, active.specializationId) : null;

  return (
    <main className="app-view dossier-home" id="main-content">
      <div className="page-width">
        <ViewHeading title="Personnel File">Alliance High Command</ViewHeading>
        {!active ? (
          <section className="dossier-file-state" aria-labelledby="no-file-title">
            <Icon className="fa-solid fa-id-card" />
            <h2 id="no-file-title">No Character on File</h2>
            <p>Build an Age of Rebellion character step by step — background, Duty, species, career, specialization, experience and gear — then play from the live sheet.</p>
            <button className="button button-primary dossier-create-action" type="button" onClick={onCreate}>Create Character</button>
          </section>
        ) : (
          <section className="dossier-file-state dossier-file-active" aria-labelledby="active-file-title">
            <p className="dossier-kicker">{derived.isPlayable ? "Active operative // ready for field use" : "Active operative // draft in progress"}</p>
            <h2 id="active-file-title">{active.name}</h2>
            <p>{derived.species?.name ?? "Species pending"} · {career?.name ?? "Career pending"} · {specialization?.name ?? "Specialization pending"}</p>
            {!derived.isPlayable && <p className="file-warning">{derived.errors.length} file check{derived.errors.length === 1 ? "" : "s"} remain before this character can use the live sheet.</p>}
            <div className="file-actions">
              <button className="button button-primary" type="button" onClick={derived.isPlayable ? onOpenSheet : onEdit}>{derived.isPlayable ? "Open Playable Sheet" : "Continue Creation"}</button>
              <button className="button button-secondary" type="button" onClick={onCreate}>New Character</button>
              <button className="button button-secondary file-delete" type="button" onClick={onDelete}>Delete Local File</button>
            </div>
            {roster.characters.length > 1 && <div className="file-switcher" aria-label="Select active character"><span>Other local files</span>{roster.characters.filter((character) => character.id !== active.id).map((character) => <button type="button" key={character.id} onClick={() => onSelectCharacter(character.id)}>{character.name}</button>)}</div>}
          </section>
        )}
        <div className="dossier-entry-grid" aria-label="Dossier tools">
          <EntryCard icon="fa-solid fa-book-open" tone="reference-icon" title="Quick Reference" onClick={onOpenRules}>Personnel and vehicle rules, pulled from your markdown library.</EntryCard>
          <EntryCard icon="fa-solid fa-dice" tone="dice-icon" title="Dice Pool" onClick={onOpenDice} modalOpen={diceOpen}>Narrative dice roller with success, advantage, triumph and despair.</EntryCard>
        </div>
        <LegacySheetArchive className="dossier-archive-sheets" />
      </div>
    </main>
  );
}

export function SheetView({ active, onCreate, onEdit, onChange }) {
  if (!active) {
    return <main className="app-view" id="main-content"><div className="page-width"><ViewHeading title="Playable Sheet">Alliance Field Operations</ViewHeading><section className="sheet-empty-state" aria-labelledby="sheet-empty-title"><Icon className="fa-solid fa-file-pen" /><h2 id="sheet-empty-title">No Active Character</h2><p>Create a personnel file first, then use this page to track wounds, strain, gear, critical injuries, and skill rolls.</p><button className="button button-primary" type="button" onClick={onCreate}>Create Character</button></section></div></main>;
  }

  const derived = deriveCharacter(active);
  if (!derived.isPlayable) {
    return <main className="app-view" id="main-content"><div className="page-width"><ViewHeading title="Playable Sheet">Alliance Field Operations</ViewHeading><section className="sheet-empty-state" aria-labelledby="draft-sheet-title"><Icon className="fa-solid fa-triangle-exclamation" /><h2 id="draft-sheet-title">File Not Ready</h2><p>Finish the required creation choices before opening the playable sheet.</p><ul>{derived.errors.map((error) => <li key={error}>{error}</li>)}</ul><button className="button button-primary" type="button" onClick={onEdit}>Continue Creation</button></section></div></main>;
  }

  return <main className="app-view companion-page" id="main-content"><div className="page-width"><ViewHeading title="Playable Sheet">Alliance Field Operations</ViewHeading><div className="companion-page-panel"><CharacterSheet character={active} onChange={onChange} onEdit={onEdit} /></div></div></main>;
}

export function CreateView({ active, onChange, onOpenSheet }) {
  if (!active) {
    return <main className="app-view companion-page" id="main-content"><div className="page-width"><ViewHeading title="Create Character">Alliance Personnel Division</ViewHeading><section className="sheet-empty-state" aria-live="polite"><Icon className="fa-solid fa-file-pen" /><h2>Opening Personnel File</h2><p>Creating a local draft…</p></section></div></main>;
  }

  return <main className="app-view companion-page" id="main-content"><div className="page-width"><ViewHeading title="Create Character">Alliance Personnel Division</ViewHeading><div className="companion-page-panel"><CharacterCreator character={active} onChange={onChange} onOpenSheet={onOpenSheet} /></div></div></main>;
}
