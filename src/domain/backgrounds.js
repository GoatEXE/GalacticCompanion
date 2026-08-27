export const BACKGROUND_STORAGE_KEY = "aor-selected-background";
export const DEFAULT_BACKGROUND = "Resources/Pursuit.jpg";

export const BACKGROUNDS = [
  ["Base", "Resources/Base.jpg"],
  ["Dusk", "Resources/Dusk.jpg"],
  ["Insignia", "Resources/Insignia.jpg"],
  ["Invasion", "Resources/Invasion.jpg"],
  ["ISD", "Resources/ISD.jpg"],
  ["ISD Fleet", "Resources/ISD-Fleet.jpg"],
  ["Jaku", "Resources/Jaku.jpg"],
  ["Planetary", "Resources/Planetary.jpg"],
  ["Pursuit", "Resources/Pursuit.jpg"]
].map(([label, path]) => ({ label, path }));

export function isKnownBackground(path) {
  return BACKGROUNDS.some((background) => background.path === path);
}

export function getStoredBackground() {
  try {
    return window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function restoreBackground() {
  const storedBackground = getStoredBackground();
  if (storedBackground && isKnownBackground(storedBackground)) return storedBackground;
  if (storedBackground) {
    try {
      window.localStorage.removeItem(BACKGROUND_STORAGE_KEY);
    } catch {
      // Storage can be disabled by the browser; the current selection still works.
    }
  }
  return DEFAULT_BACKGROUND;
}

export function storeBackground(path) {
  try {
    window.localStorage.setItem(BACKGROUND_STORAGE_KEY, path);
  } catch {
    // Storage persistence is optional.
  }
}
