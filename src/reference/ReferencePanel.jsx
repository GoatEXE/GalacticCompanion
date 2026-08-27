import React, { useEffect, useState } from "react";
import { loadRuleset, parseInlineTokens, splitTrailingCitationLink } from "../domain/content.js";

function Icon({ className }) {
  return <i className={className} aria-hidden="true" />;
}

function InlineContent({ value }) {
  let strong = false;
  return parseInlineTokens(value).map((token, index) => {
    const key = `${token.type}-${index}`;
    if (token.type === "strong-open") {
      strong = true;
      return null;
    }
    if (token.type === "strong-close") {
      strong = false;
      return null;
    }
    if (token.type === "break") return <br key={key} />;
    const content = token.type === "link"
      ? <a href={token.href} target="_blank" rel="noopener noreferrer">{token.label}</a>
      : token.value;
    return strong ? <strong key={key}>{content}</strong> : <span key={key}>{content}</span>;
  });
}

function ReferenceCard({ card }) {
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const collapseId = `${card.entryId}-collapse`;

  return (
    <article className="reference-card">
      <button
        className="reference-card-header"
        id={card.entryId}
        type="button"
        aria-expanded={open}
        aria-controls={collapseId}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon className={card.entry.icon} /> {card.entry.title}
      </button>
      {open && (
        <div className="reference-card-body" id={collapseId}>
          {card.sections.length === 0 ? <p>No quick reference details are available for this card yet.</p> : (
            <div className="reference-accordion">
              {card.sections.map((section, index) => {
                const sectionId = `${card.entryId}-section-${index}`;
                const buttonId = `${sectionId}-button`;
                const heading = splitTrailingCitationLink(section.title);
                const isOpen = openSection === index;
                return (
                  <section className="accordion-item" key={sectionId}>
                    <h3 className="accordion-heading">
                      <button
                        className="accordion-button"
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={sectionId}
                        onClick={() => setOpenSection((current) => current === index ? null : index)}
                      >
                        {heading.title}
                      </button>
                      {heading.citation && <span className="accordion-heading-citation"><InlineContent value={heading.citation} /></span>}
                    </h3>
                    {isOpen && (
                      <div className="accordion-body" id={sectionId} role="region" aria-labelledby={buttonId}>
                        <ul>{section.items.map((item, itemIndex) => <li key={`${sectionId}-${itemIndex}`}><InlineContent value={item} /></li>)}</ul>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function ReferenceCardList({ cards }) {
  return <div className="reference-grid" aria-busy="false">
    {cards.map((card) => <ReferenceCard card={card} key={card.entryId} />)}
  </div>;
}

export function ReferencePanel() {
  const [ruleset, setRuleset] = useState("personnel");
  const [state, setState] = useState({ phase: "loading", cards: [], error: null });

  useEffect(() => {
    let current = true;
    setState({ phase: "loading", cards: [], error: null });
    loadRuleset(ruleset)
      .then((cards) => {
        if (current) setState({ phase: "ready", cards, error: null });
      })
      .catch((error) => {
        if (current) setState({ phase: "error", cards: [], error });
      });
    return () => { current = false; };
  }, [ruleset]);

  useEffect(() => {
    if (state.phase !== "ready" || typeof window === "undefined") return;
    const target = window.location.hash.replace(/^#\/?/, "").toLowerCase();
    if (target.startsWith("quick-ref-")) document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [state]);

  return (
    <section className="dossier-section reference-section" id="rules-reference" aria-labelledby="reference-title">
      <div className="page-width">
        <p className="dossier-kicker section-kicker">Alliance archive // Indexed rules</p>
        <div className="section-heading-row">
          <h2 className="section-title" id="reference-title">Quick Reference</h2>
          <div className="ruleset-tabs" role="group" aria-label="Quick reference ruleset">
            <button type="button" className={ruleset === "personnel" ? "active" : ""} aria-pressed={ruleset === "personnel"} onClick={() => setRuleset("personnel")}>Personnel</button>
            <button type="button" className={ruleset === "vehicle" ? "active" : ""} aria-pressed={ruleset === "vehicle"} onClick={() => setRuleset("vehicle")}>Vehicle</button>
          </div>
        </div>
        {state.phase === "loading" && <div className="reference-status" role="status">Loading {ruleset} quick reference…</div>}
        {state.phase === "error" && <div className="reference-status error" role="alert">The quick reference could not be loaded. Please refresh the page or try another ruleset.</div>}
        {state.phase === "ready" && <ReferenceCardList cards={state.cards} />}
      </div>
    </section>
  );
}
