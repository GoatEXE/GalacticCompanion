import React, { useEffect, useMemo, useState } from "react";
import { BACKGROUNDS, CAREERS, CATALOG_SOURCES, CHARACTERISTICS, DUTIES, GEAR, SKILLS, SPECIALIZATIONS, SPECIES, findAnySpecialization, findCareer, findSpecialization, speciesGrantedSkillIds } from "./catalog.js";
import { additionalSpecializationCost, additionalSpecializationCosts, additionalSpecializationUndoBlockReason, characteristicLabels, deriveCharacter, isCareerSkill, purchasedSkillCostEntries, selectedSkillRanks, skillRankCost } from "./calculations.js";

const steps = ["Background", "Duty", "Species", "Career", "Specialization", "Experience", "Gear"];
const skillCharacteristicColumns = [
  ["brawn", "agility", "cunning"],
  ["intellect", "willpower", "presence"]
];
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

export function TrainingChooser({ title, skills, selected, count, onChange, help }) {
  return <section className="training-chooser" aria-label={title}>
    <div><h4>{title}</h4><p>{help} <b>{selected.length}/{count}</b></p></div>
    <div className="skill-choice-list" role="group" aria-label={`${title} options`}>
      {skills.map((id) => {
        const skill = SKILLS.find((entry) => entry.id === id);
        const checked = selected.includes(id);
        const name = skill?.name ?? id;
        return <button key={id} type="button" className={checked ? "selected" : ""} aria-pressed={checked} aria-label={`${name}${checked ? ", selected" : ""}`} onClick={() => onChange(toggleChoice(selected, id, count))} disabled={!checked && selected.length >= count}>{name}</button>;
      })}
    </div>
  </section>;
}

export function SkillPurchaseList({ character, ranks, remainingXp, onPurchase }) {
  const renderSkillRow = (skill) => {
    const current = ranks[skill.id];
    const careerSkill = isCareerSkill(character, skill.id);
    const nextCost = skillRankCost({ currentRank: current, career: careerSkill });
    const purchased = character.purchasedSkillRanks[skill.id] ?? 0;
    return <div key={skill.id} className={careerSkill ? "career-skill" : "non-career-skill"}><span>{skill.name}<span className="sr-only">{careerSkill ? " Career skill." : " Non-career skill."}</span></span><span>{current}/2</span><button type="button" onClick={() => onPurchase(skill, -1)} disabled={!purchased}>−</button><button type="button" onClick={() => onPurchase(skill, 1)} disabled={current >= 2 || remainingXp < nextCost}>+ <span className="sr-only">{skill.name}</span></button><small>{nextCost} XP</small></div>;
  };
  return <>
    <div className="skill-pricing-legend" aria-label="Skill pricing legend"><span className="career-key"><i aria-hidden="true" />Career skill</span><span className="non-career-key"><i aria-hidden="true" />Non-career skill</span></div>
    <div className="purchase-skill-groups">{skillCharacteristicColumns.map((column, columnIndex) => <div key={columnIndex} className="purchase-skill-column">{column.map((key) => <section key={key} className="purchase-skill-group" aria-labelledby={`purchase-${key}-title`}><h5 id={`purchase-${key}-title`}>{characteristicLabels[key]}</h5><div className="purchase-skill-list">{SKILLS.filter((skill) => skill.characteristic === key).map(renderSkillRow)}</div></section>)}</div>)}</div>
  </>;
}

function AnimatedDetails({ className, summary, children }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches));
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  const toggle = (event) => {
    event.preventDefault();
    if (closing) return;
    if (!open) {
      setOpen(true);
      return;
    }
    if (reducedMotion) {
      setOpen(false);
      return;
    }
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); }, 200);
  };
  const detailsClass = [className, closing ? "is-closing" : ""].filter(Boolean).join(" ");
  return <details className={detailsClass} open={open || closing}><summary onClick={toggle} aria-expanded={open && !closing}>{summary}</summary><div className="hierarchy-details-content"><div className="hierarchy-details-content-inner">{children}</div></div></details>;
}

export function AdditionalSpecializations({ character, remainingXp, onChange }) {
  const additionalIds = Array.isArray(character.additionalSpecializationIds) ? character.additionalSpecializationIds : [];
  const startingSpecialization = findSpecialization(character.careerId, character.specializationId);
  const ownedIds = [startingSpecialization?.globalId, ...additionalIds].filter(Boolean);
  const available = SPECIALIZATIONS.filter((specialization) => !ownedIds.includes(specialization.globalId ?? specialization.id));
  const hasStartingSpecialization = Boolean(startingSpecialization);
  const costs = additionalSpecializationCosts(character);
  const undoBlockReason = additionalSpecializationUndoBlockReason(character);
  const add = (id) => { if (!additionalIds.includes(id)) onChange([...additionalIds, id]); };
  const renderSpecialization = (specialization) => {
    const inCareer = Boolean(specialization.universal || specialization.careerId === character.careerId);
    const id = specialization.globalId ?? specialization.id;
    const cost = additionalSpecializationCost(character, id);
    const classification = specialization.universal ? "Universal specialization, In-Career." : inCareer ? "In-Career." : "Out-of-Career.";
    return <div key={id} role="listitem" className={inCareer ? "in-career-specialization" : "out-career-specialization"}><div><b>{specialization.name}</b><small>{specialization.universal ? "Universal" : findCareer(specialization.careerId)?.name}</small><span className="sr-only">{classification}</span></div><strong>{cost} XP</strong><button type="button" className="button button-secondary" onClick={() => add(id)} disabled={!hasStartingSpecialization || remainingXp < cost} aria-label={`Purchase ${specialization.name} for ${cost} XP`}>Purchase</button></div>;
  };
  const inCareerSpecializations = available.filter((specialization) => specialization.universal || specialization.careerId === character.careerId);
  const otherCareerGroups = CAREERS.filter((careerEntry) => careerEntry.id !== character.careerId).map((careerEntry) => ({ career: careerEntry, specializations: available.filter((specialization) => specialization.careerId === careerEntry.id) })).filter((group) => group.specializations.length > 0);
  return <section className="experience-subsection additional-specializations" aria-labelledby="experience-specializations-title">
    <h5 id="experience-specializations-title">Specializations</h5>
    <p className="experience-skill-note">Starting specialization is free. Purchasing an additional specialization unlocks its skill tree.</p>
    <div className="skill-pricing-legend specialization-pricing-legend" aria-label="Specialization pricing legend"><span className="career-key"><i aria-hidden="true" />In-career</span><span className="non-career-key"><i aria-hidden="true" />Out-of-career</span></div>
    {additionalIds.length > 0 && <div className="owned-specializations" aria-label="Owned additional specializations"><span className="dossier-kicker">Owned additions</span>{additionalIds.map((id, index) => { const specialization = findAnySpecialization(id); return <div key={id}><span>{specialization?.name ?? id}<small>{costs[index]?.cost ?? 0} XP paid{specialization?.universal ? " · Universal" : ""}</small></span>{index === additionalIds.length - 1 && <button type="button" className="button button-secondary" onClick={() => onChange(additionalIds.slice(0, -1))} disabled={Boolean(undoBlockReason)} aria-describedby={undoBlockReason ? "specialization-undo-help" : undefined}>Undo last</button>}</div>; })}</div>}
    {undoBlockReason && <p id="specialization-undo-help" className="specialization-undo-warning" role="status">{undoBlockReason}</p>}
    <div className="additional-specialization-list" role="list" aria-label="Available in-career specializations">{inCareerSpecializations.map(renderSpecialization)}</div>
    {otherCareerGroups.length > 0 && <AnimatedDetails className="out-career-menu" summary="Other careers"><div className="out-career-groups">{otherCareerGroups.map(({ career: otherCareer, specializations }) => <AnimatedDetails key={otherCareer.id} className="out-career-group" summary={otherCareer.name}><div className="additional-specialization-list" role="list" aria-label={`${otherCareer.name} specializations`}>{specializations.map(renderSpecialization)}</div></AnimatedDetails>)}</div></AnimatedDetails>}
    {!hasStartingSpecialization && <p className="empty-state">Choose a career and starting specialization before buying an additional specialization.</p>}
  </section>;
}

export function CharacterCreator({ character, onChange, onOpenSheet, initialStep = 0 }) {
  const [step, setStep] = useState(initialStep);
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
      careerId, specializationId: "", additionalSpecializationIds: [], careerTraining: [], specializationTraining: [], purchasedSkillRanks: {}, purchasedSkillCosts: {},
      humanBonusTraining: character.humanBonusTraining.filter((id) => !nextCareer.skillIds.includes(id))
    });
  };
  const setSpecialization = (specializationId) => {
    const nextSpecialization = findSpecialization(character.careerId, specializationId);
    update({
      specializationId,
      additionalSpecializationIds: (character.additionalSpecializationIds ?? []).filter((id) => id !== nextSpecialization?.globalId && id !== nextSpecialization?.id),
      specializationTraining: [],
      purchasedSkillRanks: {},
      purchasedSkillCosts: {},
      humanBonusTraining: character.humanBonusTraining.filter((id) => !nextSpecialization?.skillIds.includes(id))
    });
  };
  const updateAdvance = (key, direction) => {
    const current = character.characteristicAdvances[key] ?? 0;
    update({ characteristicAdvances: { ...character.characteristicAdvances, [key]: Math.max(0, current + direction) } });
  };
  const updateSkillPurchase = (skill, direction) => {
    const current = character.purchasedSkillRanks[skill.id] ?? 0;
    const nextCost = skillRankCost({ currentRank: ranks[skill.id], career: isCareerSkill(character, skill.id) });
    if (direction > 0 && (current >= 2 || derived.xp.remaining < nextCost)) return;
    if (direction < 0 && current <= 0) return;
    const recorded = purchasedSkillCostEntries(character, skill.id);
    const nextCosts = direction > 0 ? [...recorded, { cost: nextCost, career: isCareerSkill(character, skill.id) }] : recorded.slice(0, -1);
    update({ purchasedSkillRanks: { ...character.purchasedSkillRanks, [skill.id]: Math.max(0, current + direction) }, purchasedSkillCosts: { ...character.purchasedSkillCosts, [skill.id]: nextCosts } });
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
      {step === 5 && <section className="creator-step" aria-label="Experience">{!derived.species ? <p className="empty-state">Choose a species before investing XP.</p> : <div className="experience-sections"><section className="experience-subsection" aria-labelledby="experience-characteristics-title"><h5 id="experience-characteristics-title">Characteristics</h5><p className="experience-rule-callout" role="note">Characteristics can only be increased during character creation. They cannot exceed 5 unless otherwise noted.</p><div className="advancement-grid">{Object.entries(derived.characteristics).map(([key, value]) => { const nextCost = 10 * (value + 1); return <div className="advance-control" key={key}><span>{characteristicLabels[key]}</span><div><button type="button" onClick={() => updateAdvance(key, -1)} disabled={!character.characteristicAdvances[key]}>−</button><b>{value}</b><button type="button" onClick={() => updateAdvance(key, 1)} disabled={value >= 5 || derived.xp.remaining < nextCost}>+</button></div><small>Next: {nextCost} XP</small></div>; })}</div></section><section className="experience-subsection" aria-labelledby="experience-skills-title"><h5 id="experience-skills-title">Skills</h5><p className="experience-skill-note">Starting ranks cannot exceed 2.</p><SkillPurchaseList character={character} ranks={ranks} remainingXp={derived.xp.remaining} onPurchase={updateSkillPurchase} /></section><AdditionalSpecializations character={character} remainingXp={derived.xp.remaining} onChange={(additionalSpecializationIds) => update({ additionalSpecializationIds })} /></div>}</section>}
      {step === 6 && <section className="creator-step" aria-labelledby="step-gear"><h4 id="step-gear">Gear</h4><p className="companion-help">Starter budget begins at 500 credits. Catalogue entries are a compact starter list; verify availability and item details with your GM.</p><div className="gear-picker">{GEAR.map((gear) => { const checked = character.gearIds.includes(gear.id); return <label key={gear.id} className={checked ? "selected" : ""}><input type="checkbox" checked={checked} disabled={!checked && gear.cost > derived.credits.remaining} onChange={() => updateGear(gear.id)} /><span>{gear.name}</span><b>{gear.cost} cr</b><small>Enc {gear.encumbrance}</small></label>; })}</div><section className="bio-fields"><label className="field-label">Motivation<input value={character.bio.motivation} maxLength="240" onChange={(event) => update({ bio: { ...character.bio, motivation: event.target.value } })} /></label><label className="field-label">Notes<textarea value={character.bio.notes} maxLength="2000" onChange={(event) => update({ bio: { ...character.bio, notes: event.target.value } })} /></label></section></section>}
      <div className="creator-footer"><button className="button button-secondary" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Previous</button><span>Step {step + 1} of {steps.length}</span>{step < steps.length - 1 ? <button className="button button-secondary" type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>Next</button> : <button className="button button-primary" type="button" onClick={onOpenSheet} disabled={!derived.isPlayable}>Open playable sheet</button>}</div>
      {derived.errors.length > 0 && <div className="validation-summary" role="status"><b>File checks</b><ul>{derived.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    </section>
  </div>;
}
