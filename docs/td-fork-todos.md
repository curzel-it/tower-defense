# Making it its own thing — fork cleanup TODOs

This game was forked from [SneakBit](https://github.com/curzel-it/sneakbit). A
few things still carry the parent game's assumptions; this is the list to make
Tower Defense stand on its own. Status reflects what's been implemented.

---

## 1. Remove "Inventory & Equipment" from the game menu — ✅ done

In this game, items and gear are **per-run** and bought from the in-run shop
(`tdShopStock.js` / `shop.js`), so the persistent inventory/equipment screen the
parent game shows in the pause menu doesn't belong.

- Remove the **"Inventory & Equipment"** pause-menu button and the inventory
  screen it opens (`menu.js`: the `menu-open-inventory` button, the
  `data-screen="inventory"` card, the `openInventory()` route, and the
  `inventoryScreen.js` wiring).
- The ammo-HUD chip's tap-to-open-inventory shortcut (`ammoHud.js`) goes too —
  the chip stays as a read-out only.

## 2. Keep the real-money store infra (skins) — ✅ kept (skins UI = follow-up)

The Stripe/account/store stack (`storeBoot.js`, `realMoneyShop.js`,
`storeApi.js`, `storeCatalog.js`, `accountPanel.js`, `accountSession.js`,
server `paymentsRoutes.js`/`stripeWebhook.js`) **stays in place** — nothing
removed during the fork cleanup.

> **Follow-up:** there's currently no *entry point* to buy/equip skins in the
> TD build — the in-run shop excludes cosmetics (`tdShopStock.js`) and the
> inventory screen (which held the skin slot) was removed in #1. The infra is
> ready; a small skins picker still needs to be surfaced (e.g. an account-panel
> "Skins" tab, persistent across runs).

## 3. Multiplayer menu: co-op only (no PvP) — ✅ PvP removed (co-op→TD = follow-up)

The party panel (`partyPanel.js`) no longer offers PvP — the **Online PvP** and
**Offline PvP** buttons + handlers are gone, so it's **Online co-op / Offline
co-op / Tower Defense** only. The dormant PvP code paths (deathmatch, local-pvp
toggle) are now unreachable from the UI.

Co-op now launches Tower Defense: **Online co-op** = become host → start the
authoritative TD run (guests who join with the code mirror it and get a hero);
**Offline co-op** / the 2|3|4 toggle = restart TD with that many local heroes.
(`onlineDeathmatch.js`/`pvpController.js`/`pvpMatch.js` etc. can still be deleted
later — pervasive engine guards, tracked with Phase 1b.)

> **Polish (UI overhaul):** online co-op has no lobby yet — the host drops
> straight into the build phase, so a late-joining friend hops into an ongoing
> run rather than a pre-game lobby + map pick. That's part of the Bloons-style
> UI pass.

## 4. Shorten the time between waves → 10s — ✅ done

The build phase before each wave was **30s** — too long. Cut to **10s**.

- `towerDefense.js`: `BUILD_TIME = 30` → `10`.

## 5. Shared ammo + inventory; unique weapons — ⬜ todo

Heroes are a squad sharing a stash, not independent inventories:

- **Ammo + items are SHARED** across the whole squad. `inventory.js` folds every
  hero to index 0 in TD (like local co-op), so there's one pool. All heroes
  throw **kunais** from this shared kunai pool.
- **Weapons are UNIQUE singletons.** There is no "two swords of the same
  species" — you can own **one** sword, one AR-15, etc. Because the weapon *item*
  lives in the shared inventory, owning it once marks it owned globally, so the
  shop won't sell a second (`shopPurchase.isOwned`). 
- **Equip is per-hero.** `equipment.js` stays per-hero in TD: the unique weapon
  is wielded by the **one** hero who bought it (the active hero at purchase
  time). Switching heroes lets a different hero buy a *different* unique weapon.
- **Kunai is the universal baseline ranged.** Every hero can throw kunais
  regardless of archetype; unique weapons are extras layered on top.

Implementation touchpoints: `inventory.js` (fold in TD), `equipment.js` (keep
per-hero), `sessionLoadouts.js` (kunai baseline + bought-weapon override),
`towerDefense.js` starting-ammo grant (grant once into the shared pool).
