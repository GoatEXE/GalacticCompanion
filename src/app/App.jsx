import React, { useEffect, useState } from "react";
import { restoreBackground, storeBackground } from "../domain/backgrounds.js";
import { contentUrl } from "../domain/content.js";
import { DiceRoller } from "../dice/DiceRoller.jsx";
import { ReferencePanel } from "../reference/ReferencePanel.jsx";
import { CharacterDialog } from "../shell/CharacterDialog.jsx";
import { DossierShell } from "../shell/DossierShell.jsx";

function Hero({ onCharacters }) {
  return (
    <section className="hero-section dossier-section" id="home" aria-labelledby="home-title">
      <div className="page-width">
        <div className="dossier-hero">
          <p className="dossier-kicker"><i className="fa-brands fa-rebel" aria-hidden="true" /> Field reference // Alliance issue</p>
          <h1 id="home-title">Star Wars: Age of Rebellion</h1>
          <p className="hero-lead">Quick Reference Guide &amp; Dice Roller</p>
          <div className="hero-actions">
            <a className="button button-secondary" href="#rules-reference"><i className="fa-solid fa-asterisk" aria-hidden="true" /> References</a>
            <a className="button button-secondary" href="https://imadeyoursite.com/edge.html" target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-book" aria-hidden="true" /> Sources</a>
            <a className="button button-secondary" href="https://online.anyflip.com/ziisf/jobq/mobile/index.html" target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Core Rules</a>
            <button className="button button-secondary" type="button" onClick={onCharacters}><i className="fa-solid fa-sheet-plastic" aria-hidden="true" /> Characters</button>
            <a className="button button-primary dice-hero-action" href="#dice-roller"><i className="fa-solid fa-dice" aria-hidden="true" /> Dice Roller</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [background, setBackground] = useState(() => restoreBackground());
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--bg-image", `url("${contentUrl(background)}")`);
  }, [background]);

  const selectBackground = (path) => {
    setBackground(path);
    storeBackground(path);
  };

  return (
    <DossierShell
      background={background}
      onBackgroundChange={selectBackground}
      onCharacters={() => setCharacterDialogOpen(true)}
    >
      <main id="main-content">
        <Hero onCharacters={() => setCharacterDialogOpen(true)} />
        <ReferencePanel />
        <DiceRoller />
      </main>
      <CharacterDialog open={characterDialogOpen} onClose={() => setCharacterDialogOpen(false)} />
    </DossierShell>
  );
}
