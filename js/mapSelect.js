// Tower Defense map-select screen — the Bloons-style "pick a map" overlay.
// A grid of map cards grouped by difficulty tier, showing which maps are
// unlocked (and how many more unique wins open a locked tier), plus the
// player's wins + best round per map. Choosing an unlocked map starts a run on
// it; finishing a map mid-run then auto-promotes up the roster.
//
// DOM-only (per CLAUDE.md), modeled on partyPanel.js / shop.js: el() to build,
// an injected <style> with the shared --sb-* tokens, registerMenuSurface for
// keyboard/controller nav, Esc to dismiss. The run-start action is INJECTED
// (installMapSelect({ onStart })) so this screen never imports the run
// controller — it stays a pure presenter of roster + progress.

import { el } from "./dom.js";
import { registerMenuSurface, focusFirstIn } from "./menuNav.js";
import { mapRoster, unlockSummary } from "./tdMaps.js";
import { getProgress } from "./tdProgress.js";

let overlay = null;
let gridEl = null;
let installed = false;
let onStart = () => {};
let onBack = () => {};
// Per-open overrides (set by openMapSelect(opts)): a different pick action (the
// co-op lobby SELECTS a map instead of starting a run) and a different back
// target (return to the lobby, not the home screen). Null → use the installed
// defaults above.
let pickOverride = null;
let backOverride = null;
function doPick(mapId) { (pickOverride || onStart)(mapId); }
function doBack() { (backOverride || onBack)(); }

export function installMapSelect(handlers = {}) {
  onStart = handlers.onStart || (() => {});
  onBack = handlers.onBack || (() => {});
  if (installed || typeof document === "undefined") return;
  installed = true;
  injectStyles();
  buildOverlay();
  document.body.appendChild(overlay);
  registerMenuSurface({ root: () => gridEl, isOpen: isMapSelectOpen, priority: 12 });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape" || !isMapSelectOpen()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    closeMapSelect();
    doBack();   // Esc backs out to wherever opened it (home, or the co-op lobby)
  });
}

// opts.onPick(mapId) overrides the pick action for this open (default: start a
// run); opts.onBack overrides the back target (default: the installed onBack).
export function openMapSelect(opts = {}) {
  if (!installed) installMapSelect();
  if (!overlay) return;
  pickOverride = opts.onPick || null;
  backOverride = opts.onBack || null;
  renderGrid();
  overlay.style.display = "flex";
  focusFirstIn(gridEl);
}

export function closeMapSelect() {
  if (overlay) overlay.style.display = "none";
}

export function isMapSelectOpen() {
  return !!overlay && overlay.style.display === "flex";
}

function buildOverlay() {
  gridEl = el("div", { class: "td-mapsel-tiers" });
  const card = el("div", { class: "td-mapsel-card" }, [
    el("h1", { text: "Tower Defense" }),
    el("p", { class: "td-mapsel-hint", text: "Choose a map. Finish one to be promoted to the next." }),
    gridEl,
    el("div", { class: "td-mapsel-controls" }, [
      el("button", { class: "td-mapsel-btn", text: "◀ Back", on: { click: () => { closeMapSelect(); doBack(); } } }),
    ]),
  ]);
  overlay = el("div", {
    id: "td-mapsel-overlay",
    style: { display: "none" },
    on: { click: (e) => { if (e.target === overlay) closeMapSelect(); } },
  }, card);
}

function renderGrid() {
  const progress = getProgress();
  gridEl.replaceChildren();
  for (const tier of unlockSummary(progress)) {
    gridEl.appendChild(tierSection(tier));
  }
}

function tierSection(tier) {
  const heading = el("div", { class: "td-mapsel-tier-head" }, [
    el("span", { class: "td-mapsel-tier-name", text: tier.name }),
    !tier.unlocked && el("span", {
      class: "td-mapsel-tier-lock",
      text: `🔒 ${tier.winsToUnlock} more ${tier.winsToUnlock === 1 ? "win" : "wins"} to unlock`,
    }),
  ]);
  const cards = el("div", { class: "td-mapsel-grid" }, tier.maps.map(mapCard));
  return el("div", { class: "td-mapsel-tier" }, [heading, cards]);
}

function mapCard(m) {
  const meta = [el("span", { class: "td-mapsel-goal", text: `${m.waveGoal} rounds` })];
  if (m.wins > 0) meta.push(el("span", { class: "td-mapsel-wins", text: `${m.wins}× cleared` }));
  if (m.bestRound > 0) meta.push(el("span", { class: "td-mapsel-best", text: `best: round ${m.bestRound}` }));
  return el("button", {
    class: `td-mapsel-map${m.unlocked ? "" : " is-locked"}`,
    disabled: m.unlocked ? undefined : true,
    dataset: { mapId: m.id },
    on: { click: () => { if (m.unlocked) { closeMapSelect(); doPick(m.id); } } },
  }, [
    el("span", { class: "td-mapsel-map-name", text: m.name }),
    el("div", { class: "td-mapsel-map-meta" }, meta),
    !m.unlocked && el("span", { class: "td-mapsel-map-lock", text: "🔒" }),
  ]);
}

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById("td-mapsel-styles")) return;
  const style = document.createElement("style");
  style.id = "td-mapsel-styles";
  style.textContent = `
    #td-mapsel-overlay {
      position: fixed; inset: 0; z-index: 21;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.66); backdrop-filter: blur(2px);
      color: var(--sb-text, #eee); font-family: var(--sb-font, monospace);
    }
    #td-mapsel-overlay .td-mapsel-card {
      background: var(--sb-card-bg, #16161e); border: var(--sb-card-border, 1px solid #3a3a4a);
      border-radius: var(--sb-card-radius, 8px); padding: 24px 28px;
      min-width: 340px; max-width: 680px; max-height: 84vh; overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    #td-mapsel-overlay h1 { margin: 0 0 6px; font-size: 19px; letter-spacing: 1px; }
    #td-mapsel-overlay .td-mapsel-hint { color: var(--sb-text-muted, #8a8a96); font-size: 12px; margin: 0 0 16px; }

    #td-mapsel-overlay .td-mapsel-tier { margin-bottom: 18px; }
    #td-mapsel-overlay .td-mapsel-tier-head {
      display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px;
      border-bottom: 1px solid #2e2e2e; padding-bottom: 4px;
    }
    #td-mapsel-overlay .td-mapsel-tier-name { font-weight: bold; letter-spacing: 1px; }
    #td-mapsel-overlay .td-mapsel-tier-lock { color: var(--sb-text-dim, #888); font-size: 11px; }

    #td-mapsel-overlay .td-mapsel-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;
    }
    #td-mapsel-overlay .td-mapsel-map {
      position: relative; display: flex; flex-direction: column; gap: 6px;
      padding: 12px; text-align: left; cursor: pointer;
      background: #1f1f1f; border: 1px solid #2e2e2e; border-radius: var(--sb-surface-radius, 6px);
      color: var(--sb-text, #eee); font-family: inherit; font-size: 13px;
    }
    #td-mapsel-overlay .td-mapsel-map:hover:not(:disabled) { background: #292929; border-color: #3a3a3a; }
    #td-mapsel-overlay .td-mapsel-map:focus-visible, #td-mapsel-overlay .td-mapsel-map.nav-focused {
      outline: 2px solid #6af; outline-offset: 2px;
    }
    #td-mapsel-overlay .td-mapsel-map.is-locked { opacity: 0.5; cursor: not-allowed; }
    #td-mapsel-overlay .td-mapsel-map-name { font-weight: bold; }
    #td-mapsel-overlay .td-mapsel-map-meta { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--sb-text-muted, #8a8a96); }
    #td-mapsel-overlay .td-mapsel-wins { color: #8fe6a0; }
    #td-mapsel-overlay .td-mapsel-best { color: #ffd966; }
    #td-mapsel-overlay .td-mapsel-map-lock { position: absolute; top: 8px; right: 10px; font-size: 16px; }

    #td-mapsel-overlay .td-mapsel-controls { display: flex; justify-content: flex-end; margin-top: 8px; }
    #td-mapsel-overlay .td-mapsel-btn {
      background: #2a2a2a; color: #eee; border: 1px solid #444;
      padding: 8px 16px; border-radius: var(--sb-surface-radius, 6px); cursor: pointer;
      font-family: inherit; font-size: 12px;
    }
    #td-mapsel-overlay .td-mapsel-btn:hover { background: #353535; }

    @media (max-width: 480px) {
      #td-mapsel-overlay .td-mapsel-card { box-sizing: border-box; min-width: 0; width: calc(100vw - 24px); padding: 20px 14px; }
    }
  `;
  document.head.appendChild(style);
}

// Test seam.
export function _resetMapSelectForTesting() {
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null; gridEl = null; installed = false; onStart = () => {}; onBack = () => {};
  pickOverride = null; backOverride = null;
}

// Re-export so callers that already depend on this screen can read the roster
// without a second import (keeps the map-select the one place that knows the UI
// shape). Pure pass-throughs.
export { mapRoster };
