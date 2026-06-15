// Per-playerId loadout cache for online co-op. Single source of truth for
// "what is this player wearing right now" across host + guest views. The
// host writes its own entry from local equipment changes, writes guests'
// entries from incoming guest.loadout ops + pickup auto-equip, and fans
// every change out as event:loadout. The guest mirrors what it receives
// here and writes through to its own local equipment storage when the
// payload is about itself, so an auto-equipped pickup persists past the
// session.
//
// Anything that asks "what does this player have equipped" — renderers
// (entities.drawPlayer), combat (melee/shooting), damage reduction
// (playerHealth), the on-screen melee button — should route through
// resolveLoadout(player) here instead of calling getEquipped(SLOT, idx)
// directly. Offline + local-coop callers fall through to getEquipped
// transparently via the no-entry fallback, so the seam is also safe to
// use in single-player paths.

import { getEquipped, getEquippedId, SLOT_MELEE, SLOT_RANGED } from "./equipment.js";
import { isPvp, isTowerDefenseMode } from "./gameMode.js";

const loadouts = new Map(); // playerId -> { melee, ranged }

// Tower Defense baseline loadout. Every hero starts the same: the kunai
// launcher (1160), drawing from the squad's SHARED kunai pool (inventory.js
// folds ammo to one stash in TD). All other weapons — sword, AR-15, cannon,
// darkblade, … — are UNIQUE goods bought from the in-run shop and equipped by
// the one hero who buys them (equipment.js stays per-hero; inventory.js makes
// the item a squad-wide singleton). So heroes stay visually distinct (the
// 0-based index picks the sprite column + name, see towerDefense.js HERO_NAMES)
// but their kit diverges through purchases, not a fixed archetype.
const TD_BASELINE_LOADOUT = { melee: null, ranged: 1160 }; // kunai launcher

function tdHeroLoadout() {
  return TD_BASELINE_LOADOUT;
}

// In PvP everyone fights with at least a melee weapon: a player who walks
// into the arena without a melee equipped is handed the sword, so a match is
// never a ranged-only stalemate (and the melee button always has something to
// swing). Players who already brought their own melee keep it. Non-PvP play is
// untouched — a missing melee stays null. Sword = objects.name.sword.weapon.
const PVP_DEFAULT_MELEE = 1159;

export function setSessionLoadout(playerId, melee, ranged) {
  if (!playerId) return;
  loadouts.set(playerId, {
    melee: melee == null ? null : melee | 0,
    ranged: ranged == null ? null : ranged | 0,
  });
}

export function getSessionLoadout(playerId) {
  if (!playerId) return null;
  return loadouts.get(playerId) || null;
}

export function deleteSessionLoadout(playerId) {
  if (!playerId) return;
  loadouts.delete(playerId);
}

export function clearSessionLoadouts() {
  loadouts.clear();
}

export function listSessionLoadouts() {
  return Array.from(loadouts.entries()).map(([playerId, e]) => ({
    playerId, melee: e.melee, ranged: e.ranged,
  }));
}

// Resolve the equipment a given player has on. Prefers the session-map
// entry by playerId (kept in sync via the host/guest loadout-sync
// modules). Falls back to the local equipment store by index so that
// single-player and local-coop callers (no playerId on the player object)
// still get the right answer without a session entry.
export function resolveLoadout(player) {
  if (!player) return { melee: null, ranged: null };
  // Tower Defense: each slot starts on its fixed archetype, but the shop can
  // re-arm a hero — a bought weapon is written to the (transient) TD equipment
  // and overrides the archetype here, per slot. getEquippedId returns the RAW
  // stored id (null when the slot is untouched), so a melee-only archetype
  // keeps ranged: null until the player actually buys a ranged weapon — unlike
  // getEquipped, whose kunai-launcher default would mask that.
  if (isTowerDefenseMode()) {
    const idx = player.index | 0;
    const base = tdHeroLoadout(idx);
    const melee = getEquippedId(SLOT_MELEE, idx);
    const ranged = getEquippedId(SLOT_RANGED, idx);
    return { melee: melee ?? base.melee, ranged: ranged ?? base.ranged };
  }
  let melee = null;
  let ranged = null;
  const sid = player.playerId;
  const e = sid ? loadouts.get(sid) : null;
  if (e) {
    melee = e.melee ?? null;
    ranged = e.ranged ?? null;
  } else {
    const idx = player.index | 0;
    melee = getEquipped(SLOT_MELEE, idx) ?? null;
    ranged = getEquipped(SLOT_RANGED, idx) ?? null;
  }
  if (melee == null && isPvp()) melee = PVP_DEFAULT_MELEE;
  return { melee, ranged };
}

export function _resetSessionLoadoutsForTesting() { loadouts.clear(); }
