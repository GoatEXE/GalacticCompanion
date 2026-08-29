import React, { useMemo, useState } from "react";
import { BACKGROUNDS, CAREERS, CATALOG_SOURCES, CHARACTERISTICS, DUTIES, GEAR, SKILLS, SPECIES, findCareer, findSpecialization, speciesGrantedSkillIds } from "./catalog.js";
import { characteristicLabels, deriveCharacter, isCareerSkill, selectedSkillRanks, skillRankCost } from "./calculations.js";

const steps = ["Background", "Duty", "Species", "Career", "Specialization", "Experience", "Gear"];
function toggleChoice(current, value, limit) {
  if (current.includes(value)) return current.filter((entry) => entry !== value);
  return current.length < limit ? [...current, value] : current;
}

export function appendBackgroundPrompt(current, prompt) {
  const existing = String(current ?? "").trimEnd();
  return `${existing}${existing ? "\n\n" : ""}${prompt}`.slice(0, 2000);
}

function Budget({ derived }) {
  return <div className="budget-bar" aria-label="Character budgets">
    <span><b>XP</b> {derived.xp.remaining} / {derived.xp.budget}</span>
    <span><b>Credits</b> {derived.credits.remaining} / {derived.credits.budget}</span>
    <span><b>Duty</b> {derived.dutyRemaining}</span>
  </div>;
}

function ChoiceGrid({ entries, value, onChange, labelledBy }) {
  return <div className="choice-grid" role="radiogroup" aria-labelledby={labelledBy}>
    {entries.map((entry) => <button key={entry.id} type="button" role="radio" aria-checked={value === entry.id} className={value === entry.id ? "choice-card selected" : "choice-card"} onClick={() => onChange(entry.id)}>{entry.name}</button>)}
  </div>;
}

export function SpeciesSelect({ value, onChange, describedBy }) {
  return <label className="field-label species-select-field" htmlFor="species-select">Species<select id="species-select" value={value} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)}>
    <option value="">Choose a species…</option>
    {SPECIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
  </select></label>;
}

export function SpeciesDetailPanel({ species, selectedSkillIds = [] }) {
  if (!species) return <p className="empty-state species-empty">Choose a species to review its starting profile.</p>;
  const fixedSkillIds = species.setup?.startingSkillIds ?? [];
  const choice = species.setup?.startingSkillChoice;
  const skillName = (id) => SKILLS.find((skill) => skill.id === id)?.name ?? id;
  const chosenSkills = selectedSkillIds.filter((id) => !fixedSkillIds.includes(id));
  return <section className="species-detail" aria-live="polite" aria-labelledby="species-detail-title">
    <div className="species-detail-heading">
      <div><p className="dossier-kicker">Selected species</p><h5 id="species-detail-title">{species.name}</h5></div>
      <p className="source-note">Source: <a href={species.sourceUrl}>{species.sourcePage}</a></p>
    </div>
    <p className="species-description">{species.description}</p>
    <div className="species-stat-grid" aria-label={`${species.name} starting profile`}>
      <span><b>{species.startingXp}</b><small>Starting XP</small></span>
      <span><b>{species.woundBase} + Brawn</b><small>Wound threshold</small></span>
      <span><b>{species.strainBase} + Willpower</b><small>Strain threshold</small></span>
    </div>
    <div className="species-characteristics"><h6>Characteristics</h6><dl>{CHARACTERISTICS.map((key) => <div key={key}><dt>{characteristicLabels[key]}</dt><dd>{species.characteristics[key]}</dd></div>)}</dl></div>
    <div className="species-starting-skills"><h6>Starting skills</h6>{fixedSkillIds.length > 0 && <p>{fixedSkillIds.map(skillName).join(", ")}{fixedSkillIds.length === 1 ? " (one rank)" : ""}</p>}{choice && <p>Choose {choice.count}: {choice.skillIds.map(skillName).join(" or ")}{chosenSkills.length > 0 && <><br /><b>Chosen: {chosenSkills.map(skillName).join(", ")}</b></>}</p>}{fixedSkillIds.length === 0 && !choice && <p>None listed.</p>}</div>
    <div className="species-abilities"><h6>Special abilities</h6><ul>{species.abilities.map((ability) => <li key={ability.name}><b>{ability.name}:</b> {ability.summary}{ability.tableReview && <small className="table-review">Table review</small>}</li>)}</ul></div>
  </section>;
}

export function DutyDetailPanel({ duty }) {
  if (!duty) return null;
  return <details className="duty-detail" open aria-live="polite">
    <summary>Duty brief: {duty.name}</summary>
    <p>{duty.description}</p>
  </details>;
}

function TrainingChooser({ title, skills, selected, count, onChange, help }) {
  return <section className="training-chooser" aria-label={title}>
    <div><h4>{title}</h4><p>{help} <b>{selected.length}/{count}</b></p></div>
    <div className="skill-choice-list">
      {skills.map((id) => {
        const skill = SKILLS.find((entry) => entry.id === id);
        const checked = selected.includes(id);
        return <label key={id} className={checked ? "selected" : ""}><input type="checkbox" checked={checked} onChange={() => onChange(toggleChoice(selected, id, count))} disabled={!checked && selected.length >= count} /> {skill?.name ?? id}</label>;
      })}
    </div>
  </section>;
}

export function CharacterCreator({ character, onChange, onOpenSheet }) {
  const [step, setStep] = useState(0);
  const derived = useMemo(() => deriveCharacter(character), [character]);
  const career = findCareer(character.careerId);
  const specialization = findSpecialization(character.careerId, character.specializationId);
  const selectedDuty = DUTIES.find((duty) => duty.id === character.dutyId);
  const ranks = selectedSkillRanks(character);
  const update = (patch) => onChange({ ...character, ...patch });
  const useBackgroundPrompt = (prompt) => update({ backgroundText: appendBackgroundPrompt(character.backgroundText, prompt) });
  const setCareer = (careerId) => {
    const nextCareer = findCareer(careerId);
    update({
      careerId, specializationId: "", careerTraining: [], specializationTraining: [], purchasedSkillRanks: {},
      humanBonusTraining: character.humanBonusTraining.filter((id) => !nextCareer.skillIds.includes(id))
    });
  };
  const setSpecialization = (specializationId) => {
    const nextSpecialization = findSpecialization(character.careerId, specializationId);
    update({
      specializationId,
      specializationTraining: [],
      purchasedSkillRanks: {},
      humanBonusTraining: character.humanBonusTraining.filter((id) => !nextSpecialization?.skillIds.includes(id))
    });
  };
  const updateAdvance = (key, direction) => {
    const current = character.characteristicAdvances[key] ?? 0;
    update({ characteristicAdvances: { ...character.characteristicAdvances, [key]: Math.max(0, current + direction) } });
  };
  const updateSkillPurchase = (skill, direction) => {
    const current = character.purchasedSkillRanks[skill.id] ?? 0;
    update({ purchasedSkillRanks: { ...character.purchasedSkillRanks, [skill.id]: Math.max(0, current + direction) } });
  };
  const updateGear = (gearId) => update({ gearIds: character.gearIds.includes(gearId) ? character.gearIds.filter((id) => id !== gearId) : [...character.gearIds, gearId] });
  const droid = derived.species?.setup.kind === "droid";
  const human = derived.species?.setup.kind === "human";
  const humanEligible = SKILLS.filter((skill) => !career?.skillIds.includes(skill.id) && !specialization?.skillIds.includes(skill.id));
  const speciesChoice = derived.species?.setup?.startingSkillChoice;
  const speciesGranted = speciesGrantedSkillIds(derived.species, character.speciesTraining);

  return <div className="companion-workspace">
    <aside className="creator-steps" aria-label="Character creator steps">
      {steps.map((label, index) => <button key={label} type="button" className={index === step ? "active" : ""} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button>)}
    </aside>
    <section className="creator-main" aria-labelledby="creator-title">
      <div className="creator-heading"><div><p className="dossier-kicker">Personnel file // local draft</p><h3 id="creator-title">{character.name || "New operative"}</h3><p className="source-note">Source: {CATALOG_SOURCES.characterCreation}</p></div><Budget derived={derived} /></div>
      {step === 0 && <section className="creator-step" aria-labelledby="step-background"><h4 id="step-background">Background</h4><p id="background-help" className="companion-help">Write the operative's personal history in your own words. This local narrative note has no mechanical effect and is not an official rulebook selection.</p><label className="field-label">Operative name<input value={character.name} maxLength="80" onChange={(event) => update({ name: event.target.value })} /></label><div className="background-inspiration" aria-labelledby="background-inspiration-title"><p id="background-inspiration-title" className="dossier-kicker">Optional inspiration</p><p className="background-inspiration-help">Use a prompt to seed your notes; it is not an official category.</p><div className="inspiration-chips">{BACKGROUNDS.map((entry) => <button key={entry.id} className="inspiration-chip" type="button" onClick={() => useBackgroundPrompt(entry.prompt)}>{entry.name}</button>)}</div></div><label className="field-label">Background narrative<textarea value={character.backgroundText ?? ""} maxLength="2000" rows="6" aria-describedby="background-help" placeholder="Where did this operative come from, and what brought them to the Alliance?" onChange={(event) => update({ backgroundText: event.target.value })} /></label></section>}
      {step === 1 && <section className="creator-step" aria-labelledby="step-duty"><h4 id="step-duty">Duty</h4><p className="companion-help">Pick the Alliance focus, then record the starting-Duty agreement for your group. Optional exchanges are shown before they alter a budget.</p><ChoiceGrid entries={DUTIES} value={character.dutyId} onChange={(dutyId) => update({ dutyId })} labelledBy="step-duty" /><DutyDetailPanel key={selectedDuty?.id ?? "no-duty"} duty={selectedDuty} /><div className="duty-controls"><label className="field-label">Starting Duty<select value={character.startingDuty} onChange={(event) => update({ startingDuty: Number(event.target.value) })}>{[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="duty-exchanges"><label><input type="checkbox" checked={character.dutyXpExchange} disabled={!character.dutyXpExchange && character.startingDuty - (character.dutyCreditExchange ? 5 : 0) < 5} onChange={(event) => update({ dutyXpExchange: event.target.checked })} /> Exchange 5 Duty for 5 XP</label><label><input type="checkbox" checked={character.dutyCreditExchange} disabled={!character.dutyCreditExchange && character.startingDuty - (character.dutyXpExchange ? 5 : 0) < 5} onChange={(event) => update({ dutyCreditExchange: event.target.checked })} /> Exchange 5 Duty for 1,000 credits</label></div></div></section>}
      {step === 2 && <section className="creator-step" aria-labelledby="step-species"><h4 id="step-species">Species</h4><p id="species-help" className="companion-help">Choose a species. The current catalogue includes the Core Rulebook entries below; review starting characteristics, skills, and special abilities before continuing. Abilities marked for table review are not automated.</p><SpeciesSelect value={character.speciesId} onChange={(speciesId) => update({ speciesId, speciesTraining: [], humanBonusTraining: speciesId === "human" ? character.humanBonusTraining : [] })} describedBy="species-help" /><SpeciesDetailPanel key={derived.species?.id ?? "no-species"} species={derived.species} selectedSkillIds={speciesGranted} />{derived.species && speciesChoice && <TrainingChooser title="Species starting rank" skills={speciesChoice.skillIds} selected={character.speciesTraining} count={speciesChoice.count} onChange={(speciesTraining) => update({ speciesTraining })} help="Choose the free species rank." />}</section>}
      {step === 3 && <section className="creator-step" aria-labelledby="step-career"><h4 id="step-career">Career</h4><p className="companion-help">Select a starter career, then choose the free career ranks. Career and specialization skills are tracked for XP pricing.</p><ChoiceGrid entries={CAREERS} value={character.careerId} onChange={setCareer} labelledBy="step-career" />{career && <><TrainingChooser title="Career training" skills={career.skillIds} selected={character.careerTraining} count={droid ? 6 : 4} onChange={(careerTraining) => update({ careerTraining })} help="Select free starting ranks." />{human && <TrainingChooser title="Human bonus training" skills={humanEligible.map((skill) => skill.id)} selected={character.humanBonusTraining} count={2} onChange={(humanBonusTraining) => update({ humanBonusTraining })} help="Select two non-career skills." />}</>}</section>}
      {step === 4 && <section className="creator-step" aria-labelledby="step-specialization"><h4 id="step-specialization">Specialization</h4>{!career ? <p className="empty-state">Choose a career first.</p> : <><p className="companion-help">Choose one starting specialization and its free ranks. Talent tree wiring and effects are intentionally left for book review.</p><ChoiceGrid entries={career.specializations} value={character.specializationId} onChange={setSpecialization} labelledBy="step-specialization" />{specialization && <TrainingChooser title="Specialization training" skills={specialization.skillIds} selected={character.specializationTraining} count={droid ? 3 : 2} onChange={(specializationTraining) => update({ specializationTraining })} help="Select free starting ranks." />}</>}</section>}
      {step === 5 && <section className="creator-step" aria-labelledby="step-experience"><h4 id="step-experience">Experience</h4><p className="companion-help">Spend starting XP. Characteristics cost 10 × their next rating; skill ranks use career/non-career pricing. Starting ranks cannot exceed 2.</p>{!derived.species ? <p className="empty-state">Choose a species before investing XP.</p> : <><div className="advancement-grid">{Object.entries(derived.characteristics).map(([key, value]) => { const nextCost = 10 * (value + 1); return <div className="advance-control" key={key}><span>{characteristicLabels[key]}</span><div><button type="button" onClick={() => updateAdvance(key, -1)} disabled={!character.characteristicAdvances[key]}>−</button><b>{value}</b><button type="button" onClick={() => updateAdvance(key, 1)} disabled={value >= 5 || derived.xp.remaining < nextCost}>+</button></div><small>Next: {nextCost} XP</small></div>; })}</div><div className="purchase-skill-list">{SKILLS.map((skill) => { const current = ranks[skill.id]; const nextCost = skillRankCost({ currentRank: current, career: isCareerSkill(character, skill.id) }); const purchased = character.purchasedSkillRanks[skill.id] ?? 0; return <div key={skill.id}><span>{skill.name} <small>{isCareerSkill(character, skill.id) ? "career" : "non-career"}</small></span><span>{current}/2</span><button type="button" onClick={() => updateSkillPurchase(skill, -1)} disabled={!purchased}>−</button><button type="button" onClick={() => updateSkillPurchase(skill, 1)} disabled={current >= 2 || derived.xp.remaining < nextCost}>+ <span className="sr-only">{skill.name}</span></button><small>{nextCost} XP</small></div>; })}</div></>}</section>}
      {step === 6 && <section className="creator-step" aria-labelledby="step-gear"><h4 id="step-gear">Gear</h4><p className="companion-help">Starter budget begins at 500 credits. Catalogue entries are a compact starter list; verify availability and item details with your GM.</p><div className="gear-picker">{GEAR.map((gear) => { const checked = character.gearIds.includes(gear.id); return <label key={gear.id} className={checked ? "selected" : ""}><input type="checkbox" checked={checked} disabled={!checked && gear.cost > derived.credits.remaining} onChange={() => updateGear(gear.id)} /><span>{gear.name}</span><b>{gear.cost} cr</b><small>Enc {gear.encumbrance}</small></label>; })}</div><section className="bio-fields"><label className="field-label">Motivation<input value={character.bio.motivation} maxLength="240" onChange={(event) => update({ bio: { ...character.bio, motivation: event.target.value } })} /></label><label className="field-label">Notes<textarea value={character.bio.notes} maxLength="2000" onChange={(event) => update({ bio: { ...character.bio, notes: event.target.value } })} /></label></section></section>}
      <div className="creator-footer"><button className="button button-secondary" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Previous</button><span>Step {step + 1} of {steps.length}</span>{step < steps.length - 1 ? <button className="button button-secondary" type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>Next</button> : <button className="button button-primary" type="button" onClick={onOpenSheet} disabled={!derived.isPlayable}>Open playable sheet</button>}</div>
      {derived.errors.length > 0 && <div className="validation-summary" role="status"><b>File checks</b><ul>{derived.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    </section>
  </div>;
}
