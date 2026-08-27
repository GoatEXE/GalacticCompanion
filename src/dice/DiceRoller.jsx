import React, { useState } from "react";
import { clampDiceCount, createEmptyPool, createInterpretation, normalizeResults, simulateRoll } from "../domain/dice.js";

const diceGroups = [
  {
    title: "Positive Dice",
    className: "positive",
    dice: [
      ["proficiency", "Proficiency", "Yellow"],
      ["ability", "Ability", "Green"],
      ["boost", "Boost", "Blue"]
    ]
  },
  {
    title: "Negative Dice",
    className: "negative",
    dice: [
      ["challenge", "Challenge", "Red"],
      ["difficulty", "Difficulty", "Purple"],
      ["setback", "Setback", "Black"]
    ]
  }
];

const resultLabels = [
  ["success", "Net Success"],
  ["failure", "Net Failure"],
  ["advantage", "Advantage"],
  ["threat", "Threat"],
  ["triumph", "Triumph"],
  ["despair", "Despair"]
];

function DiceInput({ id, label, color, value, onChange }) {
  const adjust = (change) => onChange(clampDiceCount(value + change));
  return (
    <div className={`dice-control dice-${id}`}>
      <label htmlFor={id}>{label} <span>({color})</span></label>
      <div className="dice-stepper">
        <button type="button" onClick={() => adjust(-1)} aria-label={`Decrease ${label} dice`}>−</button>
        <input id={id} name={id} type="number" inputMode="numeric" min="0" max="10" value={value} onChange={(event) => onChange(clampDiceCount(event.target.value))} />
        <button type="button" onClick={() => adjust(1)} aria-label={`Increase ${label} dice`}>+</button>
      </div>
    </div>
  );
}

export function DiceRoller() {
  const [pool, setPool] = useState(createEmptyPool);
  const [result, setResult] = useState(null);
  const updateDie = (type, count) => setPool((current) => ({ ...current, [type]: count }));

  const roll = () => {
    const raw = simulateRoll(pool);
    setResult(normalizeResults(raw));
  };

  const clear = () => {
    setPool(createEmptyPool());
    setResult(null);
  };

  const interpretation = result && createInterpretation(result);

  return (
    <section className="dossier-section dice-section" id="dice-roller" aria-labelledby="dice-title">
      <div className="page-width">
        <p className="dossier-kicker section-kicker">Field terminal // Resolve a check</p>
        <h2 className="section-title" id="dice-title">Dice Roller</h2>
        <div className="dice-panel">
          <div className="dice-pool-heading"><h3>Dice Pool</h3><p>Build a pool, then resolve its narrative symbols.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); roll(); }}>
            <div className="dice-grid">
              {diceGroups.map((group) => (
                <fieldset className={`dice-pool-column ${group.className}`} key={group.title}>
                  <legend>{group.title}</legend>
                  {group.dice.map(([id, label, color]) => <DiceInput key={id} id={id} label={label} color={color} value={pool[id]} onChange={(count) => updateDie(id, count)} />)}
                </fieldset>
              ))}
            </div>
            <div className="dice-actions">
              <button className="button button-primary" type="submit"><i className="fa-solid fa-dice" aria-hidden="true" /> Roll Dice Pool</button>
              <button className="button button-secondary" type="button" onClick={clear}>Clear All</button>
            </div>
          </form>
          {result && (
            <section className="dice-results" aria-labelledby="results-title" aria-live="polite">
              <h3 id="results-title">Roll Results</h3>
              <div className="result-chips">
                {resultLabels.map(([key, label]) => result.normalizedResults[key] > 0 && <span className={`result-chip ${key}`} key={key}>{label}: {result.normalizedResults[key]}</span>)}
                {!resultLabels.some(([key]) => result.normalizedResults[key] > 0) && <span className="no-results">No significant results</span>}
              </div>
              <p className={`roll-interpretation ${interpretation.tone}`}>{interpretation.message}</p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
