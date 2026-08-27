import React from "react";
import { contentUrl } from "../domain/content.js";

export const LEGACY_CHARACTER_SHEETS = [
  ["B1-3B4", "Soldier", "B1 Battle Droid"], ["B1-OOM-69", "Commander", "B1 Battle Droid"], ["B2-4TY", "Ace", "B2 Super Battle Droid"],
  ["IG-96", "Spy", "IG Assassin Droid"], ["MSE-6B9", "Engineer", "Mouse Droid"], ["R5-B8", "Ace", "R5 Astromech Droid"], ["TC-42", "Diplomat", "TC Protocol Droid"]
];

export function LegacySheetArchive({ className = "" }) {
  const classes = ["archive-sheets", className].filter(Boolean).join(" ");

  return <details className={classes}>
    <summary>Legacy PDF character sheets</summary>
    <ul>{LEGACY_CHARACTER_SHEETS.map(([name, career, sheet]) => <li key={name}><a href={contentUrl(`Resources/Character Sheets/${name}.pdf`)} target="_blank" rel="noopener noreferrer">{sheet}</a> <span>{career}</span></li>)}</ul>
  </details>;
}
