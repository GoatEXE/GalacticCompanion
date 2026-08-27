import React, { useEffect, useRef } from "react";
import { DiceRoller } from "./DiceRoller.jsx";

export function DiceModal({ open, onClose }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return undefined;

    if (open) {
      if (!element.open) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        element.showModal();
      }
      closeButton.current?.focus();
    } else {
      if (element.open) element.close();
      const opener = returnFocus.current;
      const fallback = document.querySelector('[aria-controls="dice-roller"]');
      returnFocus.current = null;
      const focusTarget = opener?.isConnected ? opener : fallback;
      if (focusTarget instanceof HTMLElement) window.setTimeout(() => focusTarget.focus(), 0);
    }

    return () => {
      if (element.open) element.close();
    };
  }, [open]);

  const dismissFromBackdrop = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="dice-modal"
      aria-labelledby="dice-pool-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={dismissFromBackdrop}
    >
      <div className="dice-modal-header">
        <h2 id="dice-pool-title">Dice Pool</h2>
        <button ref={closeButton} className="dice-modal-close" type="button" onClick={onClose} aria-label="Close dice pool">×</button>
      </div>
      <DiceRoller />
    </dialog>
  );
}
