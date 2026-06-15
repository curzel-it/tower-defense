// Home / title screen — the Bloons-style front menu shown at boot, over a
// paused run. Four routes: Play (→ map select), Co-op (→ party panel), Skins
// (→ skins panel), Settings (→ pause menu). DOM-only overlay (project rule).
// The destinations are INJECTED (installHomeScreen({ onPlay, … })) so this
// screen stays a pure presenter and never imports the other panels — the boot
// wiring (main.js) connects them.

import { el } from "./dom.js";
import { registerMenuSurface, focusFirstIn } from "./menuNav.js";

let overlay = null;
let btnsEl = null;
let installed = false;
let handlers = {};

export function installHomeScreen(h = {}) {
  handlers = h;
  if (installed || typeof document === "undefined") return;
  installed = true;
  injectStyles();
  const btn = (label, key, cls = "") => el("button", {
    class: `td-home-btn ${cls}`.trim(),
    text: label,
    on: { click: () => { closeHome(); handlers[key]?.(); } },
  });
  btnsEl = el("div", { class: "td-home-btns" }, [
    btn("▶  Play", "onPlay", "td-home-primary"),
    btn("Co-op", "onCoop"),
    btn("Skins", "onSkins"),
    btn("Settings", "onSettings"),
  ]);
  overlay = el("div", { id: "td-home", style: { display: "none" } }, [
    el("div", { class: "td-home-card" }, [
      el("h1", { class: "td-home-title", text: "Tower Defense" }),
      el("p", { class: "td-home-sub", text: "Defend the path. Together." }),
      btnsEl,
    ]),
  ]);
  document.body.appendChild(overlay);
  // High priority so keyboard/controller nav targets the home buttons while it's
  // up (it sits above every other surface — it's the front menu).
  registerMenuSurface({ root: () => btnsEl, isOpen: isHomeOpen, priority: 26 });
}

export function openHome() {
  if (!installed) installHomeScreen();
  if (!overlay) return;
  overlay.style.display = "flex";
  focusFirstIn(btnsEl);
}

export function closeHome() {
  if (overlay) overlay.style.display = "none";
}

export function isHomeOpen() {
  return !!overlay && overlay.style.display === "flex";
}

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById("td-home-styles")) return;
  const style = document.createElement("style");
  style.id = "td-home-styles";
  style.textContent = `
    #td-home {
      position: fixed; inset: 0; z-index: 25;
      display: none; align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center, rgba(20,28,20,0.82), rgba(0,0,0,0.92));
      backdrop-filter: blur(3px);
      color: var(--sb-text, #eee); font-family: var(--sb-font, monospace);
    }
    #td-home .td-home-card { text-align: center; padding: 28px; }
    #td-home .td-home-title {
      margin: 0 0 6px; font-size: 40px; letter-spacing: 4px; text-transform: uppercase;
      color: #fff; text-shadow: 0 3px 0 #2a4a32, 0 5px 14px rgba(0,0,0,0.6);
    }
    #td-home .td-home-sub { margin: 0 0 28px; color: #9fcaa6; font-size: 14px; letter-spacing: 1px; }
    #td-home .td-home-btns { display: flex; flex-direction: column; gap: 12px; width: min(280px, 80vw); margin: 0 auto; }
    #td-home .td-home-btn {
      padding: 14px 18px; font-size: 16px; letter-spacing: 1px; cursor: pointer;
      background: #1f2630; color: #eee; border: 1px solid #3a4150;
      border-top-color: #525d70; border-radius: var(--sb-surface-radius, 6px);
      font-family: inherit;
    }
    #td-home .td-home-btn:hover:not(:disabled), #td-home .td-home-btn.nav-focused {
      background: #2a323e; border-color: #6a7bd0;
    }
    #td-home .td-home-primary {
      background: #2e6b3e; border-color: #418a55; border-top-color: #5cb073;
      font-weight: bold; font-size: 19px;
    }
    #td-home .td-home-primary:hover:not(:disabled) { background: #357d49; }
  `;
  document.head.appendChild(style);
}

// Test seam.
export function _resetHomeScreenForTesting() {
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null; btnsEl = null; installed = false; handlers = {};
}
