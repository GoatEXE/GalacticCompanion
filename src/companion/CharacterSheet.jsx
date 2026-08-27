import React, { useMemo, useState } from "react";
import { SKILLS, findCareer, findSpecialization } from "./catalog.js";
import { clampTracker, deriveCharacter, characteristicLabels, skillPoolFor } from "./calculations.js";
import { createInterpretation, normalizeResults, simulateRoll } from "../domain/dice.js";

const tabs = ["Skills", "Combat", "Talents", "Gear", "Bio"];

function RollResult({ result }) {
  if (!result) return null;
  const interpretation = createInterpretation(result);
  const symbols = [["success", "Success"], ["failure", "Failure"], ["advantage", "Advantage"], ["threat", "Threat"], ["triumph", "Triumph"], ["despair", "Despair"]]
    .filter(([key]) => result.normalizedResults[key] > 0);
  return <div className={`sheet-roll-result ${interpretation.tone}`} aria-live="polite"><b>{interpretation.message}</b><span>{symbols.length ? symbols.map(([key, label]) => `${result.normalizedResults[key]} ${label}`).join(" · ") : "No significant symbols"}</span></div>;
}

function Tracker({ label, value, threshold, onChange }) {
  return <div className="tracker"><span>{label}</span><div><button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(value - 1)} disabled={value <= 0}>−</button><b>{value} / {threshold}</b><button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)} disabled={value >= threshold}>+</button></div></div>;
}

export function CharacterSheet({ character, onChange, onEdit, initialTab = "Skills" }) {
  const [tab, setTab] = useState(initialTab);
  const [rollResult, setRollResult] = useState(null);
  const derived = useMemo(() => deriveCharacter(character), [character]);
  const career = findCareer(character.careerId);
  const specialization = findSpecialization(character.careerId, character.specializationId);
  const setPlay = (patch) => onChange({ ...character, play: { ...character.play, ...patch } });
  const rollSkill = (skillId, label) => {
    const pool = skillPoolFor(character, skillId);
    setRollResult({ label, pool, ...normalizeResults(simulateRoll(pool)) });
  };
  const addCritical = () => setPlay({ criticals: [...character.play.criticals, { id: `critical-${Date.now()}`, label: "Critical injury" }] });
  const updateCritical = (id, label) => setPlay({ criticals: character.play.criticals.map((critical) => critical.id === id ? { ...critical, label } : critical) });

  return <section className="playable-sheet" aria-labelledby="sheet-title">
    <header className="sheet-header"><div><p className="dossier-kicker">Active personnel file // local only</p><h3 id="sheet-title">{character.name}</h3><p>{derived.species?.name} · {career?.name} · {specialization?.name}</p></div><button className="button button-secondary" type="button" onClick={onEdit}>Edit file</button></header>
    <div className="sheet-summary"><div className="characteristics">{Object.entries(derived.characteristics).map(([key, value]) => <span key={key}><small>{characteristicLabels[key]}</small><b>{value}</b></span>)}</div><div className="trackers"><Tracker label="Wounds" value={character.play.wounds} threshold={derived.woundThreshold} onChange={(wounds) => setPlay({ wounds: clampTracker(wounds, derived.woundThreshold) })} /><Tracker label="Strain" value={character.play.strain} threshold={derived.strainThreshold} onChange={(strain) => setPlay({ strain: clampTracker(strain, derived.strainThreshold) })} /></div></div>
    <div className="sheet-tabs" role="tablist" aria-label="Character sheet sections">{tabs.map((entry) => <button key={entry} type="button" role="tab" aria-selected={tab === entry} className={tab === entry ? "active" : ""} onClick={() => setTab(entry)}>{entry}</button>)}</div>
    <div className="sheet-panel" role="tabpanel">
      {tab === "Skills" && <><p className="companion-help">Rolls start with the linked characteristic and upgrade dice for skill ranks. This is a standard two-difficulty check; adjust the shared dice roller for situational dice.</p><div className="sheet-skill-list">{SKILLS.map((skill) => <div key={skill.id}><span>{skill.name}<small>{characteristicLabels[skill.characteristic]}</small></span><b>{derived.skillRanks[skill.id]}</b><button className="button button-secondary" type="button" onClick={() => rollSkill(skill.id, skill.name)}>Roll</button></div>)}</div></>}
      {tab === "Combat" && <><p className="companion-help">Weapon rolls use the listed skill and linked characteristic with a standard two-difficulty starting pool. Range, defense, talents, and qualities remain table decisions.</p><div className="weapon-list">{derived.gear.filter((gear) => gear.skill).map((weapon) => <div key={weapon.id}><div><h4>{weapon.name}</h4><p>{weapon.skill} · Damage {weapon.damage} · Critical {weapon.critical} · {weapon.range}</p></div><button className="button button-primary" type="button" onClick={() => rollSkill(SKILLS.find((skill) => skill.name === weapon.skill)?.id, weapon.name)}>Roll attack</button></div>)}{!derived.gear.some((gear) => gear.skill) && <p className="empty-state">No weapon is recorded. Add one in Gear to make a combat roll.</p>}</div></>}
      {tab === "Talents" && <div className="talent-review"><h4>{specialization?.name} talent tree</h4><p>Talent connectors, purchase eligibility, and effects are <b>not verified or automated</b> in this MVP. Use the Core Rulebook tree at the table before recording a talent.</p><div className="talent-placeholder"><span>Core source review required</span><span>Connector diagram not reproduced</span><span>Effect text not inferred</span></div></div>}
      {tab === "Gear" && <><div className="sheet-gear-list">{derived.gear.map((gear) => <div key={gear.id}><b>{gear.name}</b><span>{gear.cost} cr · Enc {gear.encumbrance}</span></div>)}</div>{!derived.gear.length && <p className="empty-state">No gear recorded.</p>}<section className="critical-tracker"><div><h4>Critical injuries</h4><button className="button button-secondary" type="button" onClick={addCritical}>Add critical</button></div>{character.play.criticals.map((critical) => <label key={critical.id}><input aria-label="Critical injury" value={critical.label} onChange={(event) => updateCritical(critical.id, event.target.value)} /><button className="icon-button" type="button" aria-label={`Remove ${critical.label}`} onClick={() => setPlay({ criticals: character.play.criticals.filter((entry) => entry.id !== critical.id) })}>×</button></label>)}{!character.play.criticals.length && <p className="empty-state">No critical injuries tracked.</p>}</section></>}
      {tab === "Bio" && <dl className="bio-list"><div><dt>Background</dt><dd>{character.backgroundId || "Not selected"}</dd></div><div><dt>Duty</dt><dd>{character.dutyId || "Not selected"} · {derived.dutyRemaining} starting Duty remaining</dd></div><div><dt>Motivation</dt><dd>{character.bio.motivation || "Not recorded"}</dd></div><div><dt>Notes</dt><dd>{character.bio.notes || "Not recorded"}</dd></div></dl>}
    </div>
    {rollResult && <section className="sheet-roll-log" aria-label="Most recent roll"><p><b>{rollResult.label}</b> pool: {rollResult.pool.proficiency} proficiency, {rollResult.pool.ability} ability, {rollResult.pool.difficulty} difficulty.</p><RollResult result={rollResult} /></section>}
  </section>;
}
