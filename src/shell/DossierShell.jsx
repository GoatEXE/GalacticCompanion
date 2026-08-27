import React from "react";

const navigation = [
  ["dossier", "Dossier", "fa-solid fa-id-card"],
  ["create", "Create", "fa-solid fa-user-plus"],
  ["sheet", "Sheet", "fa-solid fa-file-pen"],
  ["rules", "Rules", "fa-solid fa-book-open"]
];

function Icon({ className }) {
  return <i className={className} aria-hidden="true" />;
}

export function DossierShell({ view, onNavigate, onImport, onExport, canExport, children }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="dossier-nav">
        <div className="page-width dossier-nav-inner">
          <button className="brand brand-button" type="button" onClick={() => onNavigate("dossier")} aria-label="Rebel Dossier home">
            <Icon className="fa-brands fa-rebel" />
            <span><strong>Rebel Dossier</strong><span className="dossier-eyebrow">Age of Rebellion</span></span>
          </button>
          <nav className="primary-nav" aria-label="Primary navigation">
            {navigation.map(([id, label, icon]) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                type="button"
                aria-current={view === id ? "page" : undefined}
                onClick={() => onNavigate(id)}
              >
                <Icon className={icon} /> <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="shell-actions" aria-label="Character file actions">
            <button className="shell-action" type="button" onClick={onExport} disabled={!canExport} title={canExport ? "Export active character" : "Create or import a character to export it"}>
              <Icon className="fa-solid fa-download" /> <span>Export</span>
            </button>
            <button className="shell-action" type="button" onClick={onImport}>
              <Icon className="fa-solid fa-upload" /> <span>Import</span>
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
