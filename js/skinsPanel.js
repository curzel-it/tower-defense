// Skins panel — buy (real money) and equip hero skins. Standalone DOM overlay
// (project rule: UI is never canvas), opened from the pause menu. Skins are
// cosmetic and PERSISTENT across runs (they live outside the transient TD save),
// so unlike the in-run shop's per-run coin goods they're sold for real money
// only — the parent game's Stripe/account stack (storeApi/realMoneyShop) is
// reused verbatim. Equipping applies to the hero the player is currently
// driving (the active squad slot in TD); skins.resolveSkinColumn renders it.

import { el } from "./dom.js";
import { TILE_SIZE } from "./constants.js";
import { getSprite } from "./assets.js";
import { tr } from "./strings.js";
import { playSfx } from "./audio.js";
import { showToast } from "./toast.js";
import { registerMenuSurface, focusFirstIn } from "./menuNav.js";
import {
  getCatalog, isOwned, getSelected, setSelected, onSkinChange, DEFAULT_SKIN_ID,
} from "./skins.js";
import { isTowerDefenseMode } from "./gameMode.js";
import { getActiveHeroIndex } from "./heroSwitch.js";
import { isWebStoreEnabled } from "./buildTarget.js";
import { fetchCatalog } from "./storeApi.js";
import { getCurrency, format as formatPrice } from "./storeCurrency.js";
import { startCheckout } from "./realMoneyShop.js";
import { isSignedIn } from "./accountSession.js";

let overlay = null;
let gridEl = null;
let installed = false;

// Real-money catalog (skin refId -> { sku, prices, … }), fetched once. Empty
// when the web store is off (native builds) or payments are disabled (503).
const catalogBySkin = new Map();
let catalogLoaded = false;

// The hero a skin equips onto: the active squad slot in TD, else the primary.
function equipIndex() {
  return isTowerDefenseMode() ? (getActiveHeroIndex() | 0) : 0;
}

export function installSkinsPanel() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  injectStyles();
  gridEl = el("div", { class: "skins-grid" });
  const card = el("div", { class: "skins-card" }, [
    el("h1", { text: tr("skins.title") || "Skins" }),
    el("p", { class: "skins-hint", text: "Equip a look — or unlock more." }),
    gridEl,
    el("div", { class: "skins-controls" }, [
      el("button", { class: "skins-btn", text: tr("shop.close") || "Close", on: { click: closeSkins } }),
    ]),
  ]);
  overlay = el("div", {
    id: "skins-panel", style: { display: "none" },
    on: { click: (e) => { if (e.target === overlay) closeSkins(); } },
  }, card);
  document.body.appendChild(overlay);
  registerMenuSurface({ root: () => gridEl, isOpen: isSkinsOpen, priority: 24 });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape" || !isSkinsOpen()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    closeSkins();
  }, true);
  onSkinChange(() => { if (isSkinsOpen()) renderGrid(); });
}

export function openSkins() {
  if (!installed) installSkinsPanel();
  if (!overlay) return;
  renderGrid();
  overlay.style.display = "flex";
  loadCatalog();
  focusFirstIn(gridEl);
}

export function closeSkins() {
  if (overlay) overlay.style.display = "none";
}

export function isSkinsOpen() {
  return !!overlay && overlay.style.display === "flex";
}

// Fetch the real-money catalog once, then re-render so prices appear. No-op when
// the web store is disabled; a 503/offline just leaves skins as equip-only for
// what's already owned.
async function loadCatalog() {
  if (catalogLoaded || !isWebStoreEnabled()) return;
  const r = await fetchCatalog();
  if (r.ok && Array.isArray(r.data?.items)) {
    for (const item of r.data.items) {
      if (item?.kind === "skin" && typeof item.refId === "string") catalogBySkin.set(item.refId, item);
    }
    catalogLoaded = true;
    if (isSkinsOpen()) renderGrid();
  }
}

function renderGrid() {
  const idx = equipIndex();
  const selected = getSelected(idx);
  gridEl.replaceChildren();
  for (const skin of getCatalog()) gridEl.appendChild(skinCard(skin, idx, selected));
}

function skinCard(skin, idx, selected) {
  const owned = isOwned(skin.id, idx);
  const isSelected = skin.id === selected;

  const preview = el("canvas", {
    class: "skins-preview",
    width: TILE_SIZE, height: TILE_SIZE * 2,
    style: { width: "40px", height: "80px", imageRendering: "pixelated" },
  });
  paintHero(preview, skin.column);

  const action = owned
    ? el("button", {
        class: `skins-btn skins-equip${isSelected ? " is-on" : ""}`,
        text: isSelected ? "Equipped" : "Equip",
        disabled: isSelected || undefined,
        on: { click: () => equip(skin.id, idx) },
      })
    : buyAction(skin);

  return el("div", { class: `skins-item${isSelected ? " is-selected" : ""}` }, [
    preview,
    el("span", { class: "skins-name", text: tr(skin.nameKey) || skin.id }),
    el("span", { class: `skins-rarity skins-rarity-${skin.rarity}`, text: skin.rarity }),
    action,
  ]);
}

// Unowned skins are real-money only (persistent cosmetics — TD coins are
// per-run). Show a price + Buy when the web store + catalog are available,
// routing through Stripe Checkout (startCheckout handles the signed-out case).
function buyAction(skin) {
  const cat = catalogBySkin.get(skin.id);
  if (!isWebStoreEnabled() || !cat) {
    return el("span", { class: "skins-locked", text: "🔒" });
  }
  const priceText = formatPrice(cat.prices[getCurrency()], getCurrency());
  const label = isSignedIn() ? `Buy ${priceText}` : "Sign in to buy";
  return el("button", {
    class: "skins-btn skins-buy",
    text: label,
    on: { click: () => startCheckout(cat.sku) },
  });
}

function equip(skinId, idx) {
  if (!setSelected(skinId, idx)) return;
  playSfx("hintReceived", { volume: 0.5 });
  const skin = getCatalog().find((s) => s.id === skinId);
  showToast(`${skin ? (tr(skin.nameKey) || skin.id) : "Skin"} equipped`, "hint");
  renderGrid();
}

// Blit a hero's down-facing still from the `heroes` sheet at the given column
// (1×2 tiles). Mirrors shop.js's preview math. null column = the default look.
function paintHero(canvas, column) {
  const col = column == null ? 1 : column;
  let sheet;
  try { sheet = getSprite("heroes"); } catch { return; }
  if (!sheet || !sheet.complete) return;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sheet, col * TILE_SIZE, 11 * TILE_SIZE, TILE_SIZE, TILE_SIZE * 2, 0, 0, TILE_SIZE, TILE_SIZE * 2);
}

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById("skins-panel-styles")) return;
  const style = document.createElement("style");
  style.id = "skins-panel-styles";
  style.textContent = `
    #skins-panel {
      position: fixed; inset: 0; z-index: 23;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(2px);
      color: var(--sb-text, #eee); font-family: var(--sb-font, monospace);
    }
    #skins-panel .skins-card {
      background: var(--sb-card-bg, #16161e); border: var(--sb-card-border, 1px solid #3a3a4a);
      border-radius: var(--sb-card-radius, 8px); padding: 22px 26px;
      min-width: 320px; max-width: 640px; max-height: 86vh; overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    #skins-panel h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: 1px; }
    #skins-panel .skins-hint { color: var(--sb-text-muted, #8a8a96); font-size: 12px; margin: 0 0 16px; }
    #skins-panel .skins-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;
    }
    #skins-panel .skins-item {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 12px 10px; background: #1f1f29; border: 1px solid #33333f;
      border-radius: var(--sb-surface-radius, 6px);
    }
    #skins-panel .skins-item.is-selected { border-color: #6af; box-shadow: 0 0 0 1px #6af inset; }
    #skins-panel .skins-preview { background: #11141b; border: 1px solid #2c2c38; border-radius: 4px; }
    #skins-panel .skins-name { font-size: 13px; font-weight: bold; text-align: center; }
    #skins-panel .skins-rarity { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8a8a96; }
    #skins-panel .skins-rarity-rare { color: #ffd966; }
    #skins-panel .skins-locked { font-size: 16px; }
    #skins-panel .skins-btn {
      background: #2a2a32; color: #eee; border: 1px solid #44444f;
      padding: 7px 14px; border-radius: var(--sb-surface-radius, 6px); cursor: pointer;
      font-family: inherit; font-size: 12px;
    }
    #skins-panel .skins-btn:hover:not(:disabled) { background: #353541; }
    #skins-panel .skins-btn:disabled { opacity: 0.6; cursor: default; }
    #skins-panel .skins-equip.is-on { background: #2e6b3e; border-color: #418a55; }
    #skins-panel .skins-buy { background: #2c4a6b; border-color: #3f6da0; color: #cfe6ff; }
    #skins-panel .skins-buy:hover { background: #34588a; }
    #skins-panel .skins-controls { display: flex; justify-content: flex-end; margin-top: 14px; }
    @media (max-width: 480px) {
      #skins-panel .skins-card { box-sizing: border-box; min-width: 0; width: calc(100vw - 24px); padding: 18px 12px; }
    }
  `;
  document.head.appendChild(style);
}

// Test seam.
export function _resetSkinsPanelForTesting() {
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null; gridEl = null; installed = false;
  catalogBySkin.clear(); catalogLoaded = false;
}
