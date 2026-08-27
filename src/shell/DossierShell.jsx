import React from "react";
import { BACKGROUNDS } from "../domain/backgrounds.js";

function Icon({ className }) {
  return <i className={className} aria-hidden="true" />;
}

export function DossierShell({ background, onBackgroundChange, onCharacters, children }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="dossier-nav">
        <div className="page-width dossier-nav-inner">
          <a className="brand" href="#home" aria-label="Age of Rebellion dossier home">
            <Icon className="fa-brands fa-rebel" />
            <span>
              <span className="dossier-eyebrow">Alliance Command</span>
              Age of Rebellion
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <a href="#dice-roller"><Icon className="fa-solid fa-dice" /> Dice Roller</a>
            <a href="#rules-reference"><Icon className="fa-solid fa-book-open" /> Rulesets</a>
            <a href="#rules-reference"><Icon className="fa-solid fa-list" /> Quick Reference</a>
            <details className="background-menu">
              <summary><Icon className="fa-solid fa-image" /> Backgrounds</summary>
              <div className="menu-panel">
                {BACKGROUNDS.map((option) => (
                  <button
                    key={option.path}
                    type="button"
                    className={option.path === background ? "active" : ""}
                    aria-pressed={option.path === background}
                    onClick={() => onBackgroundChange(option.path)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </details>
          </nav>
        </div>
      </header>
      {children}
      <nav className="mobile-field-nav" aria-label="Field navigation">
        <a href="#home"><Icon className="fa-brands fa-rebel" /><span>Dossier</span></a>
        <a href="#rules-reference"><Icon className="fa-solid fa-book-open" /><span>Reference</span></a>
        <a href="#dice-roller"><Icon className="fa-solid fa-dice" /><span>Dice</span></a>
        <button type="button" onClick={onCharacters}><Icon className="fa-solid fa-sheet-plastic" /><span>Sheets</span></button>
        <details className="mobile-background-menu">
          <summary aria-label="Select background"><Icon className="fa-solid fa-image" /><span>Backdrop</span></summary>
          <div className="menu-panel">
            {BACKGROUNDS.map((option) => (
              <button key={option.path} type="button" className={option.path === background ? "active" : ""} aria-pressed={option.path === background} onClick={() => onBackgroundChange(option.path)}>{option.label}</button>
            ))}
          </div>
        </details>
      </nav>
      <footer className="dossier-footer">
        <div className="page-width">
          <p>© 2024 Star Wars: Age of Rebellion Quick Reference. For personal use only.</p>
          <p>Star Wars and all related properties are trademarks of Lucasfilm Ltd.</p>
        </div>
      </footer>
    </div>
  );
}
