// Entry point. Wires features together; holds no game logic itself.

import { STARTING_ZONE_ID, STARTING_SPAWN, PVP_ARENA_ZONE_ID } from "./constants.js";
import { loadAssets } from "./assets.js";
import { loadSpecies, loadStrings } from "./data.js";
import { loadStringsData, tr } from "./strings.js";
import { installDialogue, isDialogueOpen } from "./dialogue.js";
import { installInteract, tickInteract, tryInteractForSlot } from "./interact.js";
import { loadSpeciesData } from "./species.js";
import { composeBiomeSheet } from "./biomeSheet.js";
import { buildZone, isTeleporterLocked } from "./zone.js";
import { pickCoopSpawn } from "./coopSpawn.js";
import { initInput, pollInput, clearInputState, clearInputHeld, pushInputPress } from "./input.js";
import { createPlayer, updatePlayer, updateGuestAvatar } from "./player.js";
import { createCamera, updateCamera, cameraRectFor } from "./camera.js";
import { createRenderer, render, renderViewports } from "./renderer.js";
import { startGameLoop } from "./gameLoop.js";
import { createBiomeAnimation, tickBiomeAnimation } from "./biomeAnimation.js";
import { tickEntities } from "./entities.js";
import { installAutoZoom, reapplyAutoZoom } from "./zoom.js";
import { sliceCount, recomputeSlices, getSlices } from "./splitScreen.js";
import { installHud, updateHud } from "./hud.js";
import { loadAudio } from "./audio.js";
import { loadSettings, getSettings, resolveLanguage } from "./settings.js";
import { installMenu, isMenuOpen, openMenu } from "./menu.js";
import { installMusic, playTrack } from "./music.js";
import { installTouchControls, setInteractPrompt, updateTouchCombat } from "./touch.js";
import { installToast, showToast } from "./toast.js";
import { installShooting, tickShooting, tryShoot, tryShootForSlot } from "./shooting.js";
import { installMelee, tickMelee, tryMelee, tryMeleeForSlot } from "./melee.js";
import { installWeaponSelect, cycleWeapon } from "./weaponSelect.js";
import { SLOT_RANGED, SLOT_MELEE } from "./equipment.js";
import { setGamepadAction } from "./gamepad.js";
import { pollGuestGamepad } from "./guestInputForwarder.js";
import { installActiveInputDevice } from "./activeInputDevice.js";
import { installControllerPresence, isControllerPaused } from "./controllerPresence.js";
import { installAmmoHud, updateAmmoHud } from "./ammoHud.js";
import { installCoinHud, updateCoinHud } from "./coinHud.js";
import { seedStartingCoins } from "./wallet.js";
import { tickMobs } from "./mobs.js";
import { tickCombat } from "./combat.js";
import { tickPlayerHealth, isPlayerDead, resetPlayerHealth } from "./playerHealth.js";
import { tickKnockbackAura, resetKnockbackAura } from "./knockbackAura.js";
import { installHealthHud, refreshHealthHud } from "./healthHud.js";
import { installGiantTimerBar } from "./giantTimerBar.js";
import { installGameOver, isGameOverOpen, showGameOver } from "./gameOver.js";
import { installShop, isShopOpen } from "./shop.js";
import { installMessage, isMessageOpen } from "./message.js";
import { applyFirstLaunch } from "./firstLaunch.js";
import { loadProgress, saveProgress, clearProgress } from "./save.js";
import { getZoneCache } from "./zoneCache.js";
import { tickPushables } from "./pushables.js";
import { updateVisibleEntities } from "./zoneVisibility.js";
import { isCoopMode, setCoopMode, setLocalPlayerCount, localPlayerCount } from "./coopMode.js";
import { showLoadingScreen, bumpLoadingProgress, hideLoadingScreen } from "./loadingScreen.js";
import { runMigrations } from "./migrations.js";
import { bootstrapOnline, onAnyClose } from "./onlineBootstrap.js";
import { getMirrorZone, getMirrorPlayers, isMirrorReady, isMirrorDead, refreshMirrorEntities } from "./mirrorWorld.js";
import { tickPredictedSelf, getPredictedSelf } from "./predictedSelf.js";
import { tickLocalEffects } from "./localEffects.js";
import { getSelfPlayerId } from "./onlineBootstrap.js";
import { installPartyPanel, isPartyPanelOpen } from "./partyPanel.js";
import { installAccountPanel, isAccountPanelOpen } from "./accountPanel.js";
import { installCloudSave } from "./cloudSave.js";
import { installStore } from "./storeBoot.js";
import { installHostLaggingOverlay, updateHostLaggingOverlay } from "./hostLaggingOverlay.js";
import { setHostPaused } from "./hostPauseState.js";
import { getRuntimeRole, getMode, getJoinCode, setRuntimeRole } from "./onlineMode.js";
import { switchRole, setStateHandlers } from "./switchRole.js";
import { installUiTokens } from "./uiTokens.js";
import { isPvp, isTowerDefenseMode } from "./gameMode.js";
import { codesFor } from "./keyBindings.js";
import { installTowerDefense, startTowerDefense, tickTowerDefense } from "./towerDefense.js";
import { openMapSelect } from "./mapSelect.js";
import { openSkins } from "./skinsPanel.js";
import { openPartyPanel } from "./partyPanel.js";
import { installHomeScreen, openHome } from "./homeScreen.js";

// Live game state. Module-level so switchRole's state-handlers (and the
// beforeunload listener / window.save shim) can read and mutate it
// through stable references. Single instance for the page's lifetime;
// rebuilt in place on host/guest → offline transitions.
let state = null;

async function main() {
  // Land the shared CSS variables before any feature stylesheet that
  // references them is injected.
  installUiTokens();
  bootstrapOnline();             // seeds runtime role from URL; doesn't install role modules
  installPartyPanel();
  // Account UI is lazy + offline-tolerant: it installs here (so the pause
  // menu's "Account" row and the ?reset=… deep link work) but makes no
  // blocking network call at boot.
  installAccountPanel();
  // Cloud saves: lazy + offline-tolerant. Pulls on sign-in, debounced-pushes
  // on progress change. No-op while signed out; never blocks boot.
  installCloudSave();
  // Real-money store: reconcile entitlements on sign-in/boot and handle the
  // ?purchase= return from Stripe Checkout. Offline-tolerant; never blocks boot.
  installStore();
  installHostLaggingOverlay();
  // `?join=CODE` tabs with a *well-formed* code are guests for the
  // lifetime of the page — they never own a local save and shouldn't
  // touch localStorage's identity bits, run the first-launch tutorial,
  // render an HP/ammo HUD off the wrong source, or open the
  // fast-travel/map-editor against a zone they don't own. A malformed
  // `?join=…` (or `?join=` with nothing) keeps the page in offline mode
  // so the party panel can still take a code from the user — without
  // that fallback, the game loop later reads a null player.tileX. The
  // runtime equivalent (offline → guest via party panel) is handled
  // per-feature in switchRole / menu gating.
  const bootGuest = getMode() === "guest" && !!getJoinCode();
  // Fewer steps on the guest path — no migrations, no offline-state
  // zone load, no first-launch toast. Loading screen also swaps to a
  // "Connecting to host…" label everywhere.
  showLoadingScreen(bootGuest ? 4 : 5);
  const progressLabel = (label) => bootGuest ? "Connecting to host…" : label;
  if (!bootGuest) runMigrations();
  initInput();
  loadSettings();
  loadAudio();
  const hud = installHud();
  // installMenu accepts a state getter so the creative-mode "Save zone"
  // / "Export zone" / "Reset zone" actions can read state.rawZone and
  // state.zone?.id at click time. `state` isn't assigned yet here —
  // that's fine, the closure resolves it lazily when the user clicks.
  installMenu(() => state);
  installMusic();
  installDialogue();
  installToast();
  installTouchControls();
  installGameOver();
  installShop();
  installMessage();
  if (!bootGuest) applyFirstLaunch();

  // Always load English as the fallback table; load the resolved language on
  // top of it (skip the second fetch when it resolves to English). tr()
  // prefers the active table and falls back to English per-key.
  const lang = resolveLanguage();
  const [, speciesRaw, enRaw, langRaw] = await Promise.all([
    loadAssets().then(r => { bumpLoadingProgress(progressLabel("Sprites loaded")); return r; }),
    loadSpecies().then(r => { bumpLoadingProgress(progressLabel("Species loaded")); return r; }),
    loadStrings("en").then(r => { bumpLoadingProgress(progressLabel("Strings loaded")); return r; }),
    lang === "en" ? Promise.resolve(null) : loadStrings(lang).catch(() => null),
  ]);
  loadSpeciesData(speciesRaw);
  loadStringsData(langRaw ?? enRaw, enRaw);
  await composeBiomeSheet();

  // Build the offline state up front so the page is always ready to
  // render *something* — even guests fall back to offline view when a
  // session ends. switchRole later wipes/rebuilds these fields in place
  // when transitioning between roles. Guests skip the build: no
  // STARTING_ZONE_ID load, no loadProgress, no zone bake. They get a
  // bare stub with just a camera so installAutoZoom has something to
  // bind to.
  if (bootGuest) {
    const cam = createCamera();
    state = { zone: null, rawZone: null, player: null, player2: null, players: [], camera: cam, cameras: [cam] };
  } else {
    await initOfflineState();
  }
  bumpLoadingProgress(progressLabel("Ready"));
  hideLoadingScreen();

  const canvas = document.getElementById("game");
  const renderer = createRenderer(canvas);
  const biomeAnim = createBiomeAnimation();
  let suppressUnloadSave = false;
  window.addEventListener("beforeunload", () => {
    if (suppressUnloadSave) return;
    flushPendingProgress();
  });
  if (typeof window !== "undefined") {
    window.save = {
      now: () => saveProgress(state),
      reset: () => { clearProgress(); location.reload(); },
      // Called by menu.js's New Game / Clear-cache handlers *before* they
      // wipe localStorage. Without this guard the beforeunload listener
      // above would re-save the current player position on top of the
      // freshly-cleared save, so the page would reload right back into
      // the zone+tile the player just tried to leave.
      suppressUnloadSave: () => { suppressUnloadSave = true; },
    };
    // Local co-op test/debug hook (mirrors window.save/creative). Lets
    // e2e set the local player count and drive each slot through the real
    // input pipeline + read avatar positions.
    window.coop = {
      setLocalPlayers,
      count: () => localPlayerCount(),
      positions: () => {
        const out = [];
        const add = (p) => p && out.push({ index: p.index | 0, tileX: p.tileX, tileY: p.tileY, direction: p.direction });
        add(state.player);
        add(state.player2);
        for (const s of state.players) add(s.player);
        return out;
      },
      // Single-tile tap: queue one press then drop the held set, so the
      // avatar takes exactly one step (no continuous walk).
      tap: (slot, dir) => { pushInputPress(slot, dir); clearInputHeld(slot); },
      // Live split-screen geometry: one entry per slice with its backing-pixel
      // rect and its camera's tile dimensions. Lets e2e assert the layout
      // (count + arrangement) for a given window size + player count.
      slices: () => getSlices().map((s, i) => ({
        rectPx: s.rectPx,
        camW: state.cameras[i]?.w ?? null,
        camH: state.cameras[i]?.h ?? null,
      })),
    };
  }
  // Tower Defense is offline-only and additive: it installs here (HUD,
  // barricade placement, input routing, debug hook) but does nothing until a
  // run boots via ?mode=td or the party panel.
  installTowerDefense(() => state);
  // Home/title screen — the Bloons-style front menu shown at boot, over a paused
  // run. Its buttons route to the (lazily-installed) panels.
  installHomeScreen({
    onPlay: openMapSelect,
    onCoop: openPartyPanel,
    onSkins: openSkins,
    onSettings: openMenu,
  });
  installAutoZoom(canvas, state.camera, hud.el, () => recomputeSlices(canvas, state));
  // Guests don't own the world, world-mutating logic, or the warp graph
  // — so the simulation modules (mapEditor, interact, shooting/melee,
  // fastTravel) stay gated. The HUDs (HP + ammo) DO run on guests: the
  // guestSelfHpSync module mirrors the host's authoritative HP into
  // playerHealth.records[0] and the per-player ammoSet events keep the
  // inventory in lockstep, so the HUDs render the right numbers.
  installAmmoHud();
  installCoinHud();
  // Grant the one-time starting purse before the HUD's first paint so a fresh
  // save reads 50 rather than flashing 0. Idempotent on a seeded save.
  seedStartingCoins();
  installHealthHud();
  installGiantTimerBar();
  installActiveInputDevice();
  installControllerPresence();
  // These listeners stay installed for the lifetime of the page,
  // including during guest sessions — every install fn either gates
  // internally on getNetRole === "guest" or only acts via a tick path
  // that the guest loop never calls. The old `if (!bootGuest)` gate
  // broke deep-link guests on leave: a ?join=CODE tab that switched
  // back to offline via Leave Coop had no shoot/melee/interact/
  // fast-travel/map-editor listeners attached, so those inputs
  // silently did nothing until the page was reloaded into offline
  // (which itself requires manually clearing ?join= from the URL).
  installInteract(() => state);
  installShooting(() => state);
  installMelee(() => state);
  installWeaponSelect({
    isBlocked: () =>
      isMenuOpen() || isDialogueOpen() || isGameOverOpen() || isShopOpen() ||
      isMessageOpen() || isPartyPanelOpen() || isAccountPanelOpen(),
  });
  setGamepadAction("shoot", () => {
    // In Tower Defense the Shoot button fires the active hero during a wave;
    // build-phase presses are inert (onKey ignores them). Synthesise the key so
    // towerDefense.onKey routes it through possession.
    if (isTowerDefenseMode()) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: codesFor("shoot")[0] || "KeyF" }));
      return;
    }
    tryShoot();
  });
  setGamepadAction("melee", () => {
    // In Tower Defense Melee swings the active hero during a wave (build-phase
    // presses are inert). Synthesise the key so towerDefense.onKey routes it to
    // the active hero. melee.js's own listener no-ops in TD, so no double swing.
    if (isTowerDefenseMode()) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: codesFor("melee")[0] || "KeyG" }));
      return;
    }
    tryMelee();
  });
  setGamepadAction("interact", () => {
    // Synthesise an interact keypress so interact.js's listener fires
    // without us having to duplicate its "find entity in front" logic.
    // (In the TD build phase this is also how Interact places a barrel.)
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
  });
  // Local co-op P2-P4 pads drive slots 2-4 through the same per-slot
  // action seams the network guests use, so a 2nd/3rd/4th physical
  // controller fights and interacts as its own player.
  for (const slot of [2, 3, 4]) {
    setGamepadAction("shoot", () => tryShootForSlot(slot), slot);
    setGamepadAction("melee", () => tryMeleeForSlot(slot), slot);
    setGamepadAction("interact", () => tryInteractForSlot(slot), slot);
  }
  // Weapon-cycle pads, one per local slot (melee wired but unbound by
  // default). cycleWeapon takes the 0-based local player index.
  for (const slot of [1, 2, 3, 4]) {
    const idx = slot - 1;
    setGamepadAction("rangedNext", () => cycleWeapon(SLOT_RANGED, idx, +1), slot);
    setGamepadAction("rangedPrev", () => cycleWeapon(SLOT_RANGED, idx, -1), slot);
    setGamepadAction("meleeNext",  () => cycleWeapon(SLOT_MELEE,  idx, +1), slot);
    setGamepadAction("meleePrev",  () => cycleWeapon(SLOT_MELEE,  idx, -1), slot);
  }
  if (state.zone?.soundtrack) playTrack(state.zone.soundtrack);

  // Wire switchRole's state-handler registry so role transitions can
  // rebuild / wipe the world state. Done BEFORE the boot deep-link
  // dispatch so a ?host=1 / ?join=CODE entry has working callbacks.
  setStateHandlers({
    onEnterOffline: rebuildOfflineState,
    onEnterHost: tagHostPlayerId,
    onEnterGuest: wipeGuestState,
    stateGetter: () => state,
    p2Factory: makeCoopP2,
  });

  // 4005 = "kicked by host". net.js already suppresses auto-reconnect on
  // this code; here we surface the UX side (toast + drop back to
  // offline). Per docs/multiplayer.md §Close codes.
  onAnyClose(({ code }) => {
    if (code !== 4005) return;
    showToast("You were removed from the session", "longHint");
    switchRole("offline").catch((e) => console.error("[kick] switchRole(offline)", e));
  });

  // Honor the boot URL. resolveMode already seeded runtimeRole in
  // bootstrapOnline; the explicit setRuntimeRole("offline") fires
  // subscribers (status chip, party panel) on the offline path too so
  // they paint the initial empty state.
  const urlRole = getMode();
  if (urlRole === "host") {
    await switchRole("host");
  } else if (urlRole === "guest" && getJoinCode()) {
    await switchRole("guest", { code: getJoinCode() });
  } else {
    setRuntimeRole("offline");
  }

  // This is a Tower Defense game: the offline boot starts a TD run on the first
  // map, then raises the home/title screen on top (which pauses the run) — Play
  // opens the map picker, Co-op/Skins/Settings route elsewhere. (Online co-op TD
  // is launched from the party panel after hosting/joining, which sets the host
  // role above and skips this branch.)
  if (getRuntimeRole() === "offline") {
    await startTowerDefense();
    openHome();
  }

  startGameLoop((dt) => {
    if (getRuntimeRole() === "guest") {
      tickGuestFrame(dt, state, renderer, hud, biomeAnim);
      return;
    }
    // Tower Defense owns its whole frame (sim + render) — like the guest path.
    if (isTowerDefenseMode()) {
      tickTowerDefense(dt, { renderer, hud, biomeAnim });
      return;
    }
    // Every shipped flow is a Tower Defense run — offline solo, local
    // split-screen co-op, or an online-co-op host. tickTowerDefense (above)
    // owns the whole sim + render frame and no-ops until a board exists, so a
    // host sitting in the lobby before "Start" is safely idle here. The old
    // SneakBit normal-game / PvP frame is gone.
  });

}

let mirrorDeathHandled = false;
function maybeFallBackToOffline() {
  if (mirrorDeathHandled) return;
  if (!isMirrorDead()) return;
  mirrorDeathHandled = true;
  showToast("Lost host — going offline", "longHint");
  // Transition in-place instead of reloading the page. switchRole's
  // offline setup re-runs initOfflineState via the registered handler,
  // so the player lands back in their own save world cleanly.
  switchRole("offline").then(() => { mirrorDeathHandled = false; });
}

// Build the initial offline state. There is no SneakBit overworld to load
// anymore: the offline boot is a bare stub (camera only) and the real board is
// built by startTowerDefense() → loadMap() → tdBaseZone(). This mirrors the
// guest stub shape; the camera/cameras are preserved across role switches so
// installAutoZoom's captured reference stays stable.
async function initOfflineState() {
  const camera = state?.camera ?? createCamera();
  const cameras = Array.isArray(state?.cameras) ? state.cameras : [camera];
  cameras[0] = camera;
  state = { zone: null, rawZone: null, player: null, player2: null, players: [], camera, cameras };
}

// switchRole onEnterOffline callback. Re-runs the offline-state build so a
// player returning from a session lands back on a clean offline stub (a fresh
// TD run is started explicitly afterwards).
async function rebuildOfflineState() {
  await initOfflineState();
}

// switchRole onEnterGuest callback. The guest's view comes from the
// mirror; the local sim doesn't run. Wipe state.zone/player so a stale
// tick can't accidentally read host-world data that isn't there, and
// drop any saved-progress side-effects the offline beforeunload listener
// might otherwise dispatch (saveProgress no-ops on missing zone/player).
function wipeGuestState() {
  if (!state) return;
  state.zone = null;
  state.rawZone = null;
  state.player = null;
  state.player2 = null;
  state.players = [];
  state.lastTile = null;
  state.lastTile2 = null;
}

// switchRole onEnterHost callback. Tags the host's local avatar with
// the server-assigned playerId so entities.js can find the display
// name. If welcome hasn't arrived yet (first open WS), the tag is
// applied later via the welcome handler in onlineBootstrap — entities
// label fallback is graceful in the meantime.
function tagHostPlayerId() {
  if (!state?.player) return;
  // Local co-op (P2-P4 on this machine) doesn't combine with online
  // hosting — guests fill those slots. Reset to a single local player and
  // drop any local-only avatars so they can't collide with guest slot
  // assignment. (The UI already hides "Host" while local co-op is on; this
  // is a defensive backstop.)
  setLocalPlayerCount(1);
  if (state.player2 && !state.player2.playerId) { state.player2 = null; state.lastTile2 = null; }
  if (Array.isArray(state.players)) state.players = state.players.filter((e) => e.playerId != null);
  refreshHealthHud();
  const pid = getSelfPlayerId();
  if (pid) state.player.playerId = pid;
}

// Guest-mode tick: skips simulation entirely (the host owns the world)
// and renders from the mirror. The mirror's zone arrives with the first
// snapshot; until then the canvas stays blank with the loading-screen
// overlay still visible. predictedSelf is advanced each frame so the
// guest's own avatar moves locally with zero perceived latency; on
// snapshot/delta we snap it back to whatever the host says.
function tickGuestFrame(dt, state, renderer, hud, biomeAnim) {
  // Forward this guest's own controller input to the host each frame
  // (no-op when the forwarder isn't installed or no pad is connected).
  pollGuestGamepad();
  maybeFallBackToOffline();
  updateHostLaggingOverlay();
  const mZone = getMirrorZone();
  tickBiomeAnimation(biomeAnim, dt);
  tickEntities(dt);
  // Decay melee swing cooldowns on the guest too. The guest's own swing is
  // predicted locally (predictGuestSwing) and remote swings arrive via the
  // mirror (snapshot sw/swd → melee.setSwingAnimation); without this tick
  // the cooldown never drains, so the swing animation would freeze at its
  // first frame and never finish.
  tickMelee(dt);
  // Same for the predicted-self firing pose (predictGuestShoot arms it).
  // tickShooting no-ops its bullet advance while the guest's local zone is
  // wiped; here it just drains the fire-anim timer so the pose finishes.
  tickShooting(dt);
  // Age out the guest's local cosmetic flashes (muzzle flash, etc).
  tickLocalEffects(dt);
  if (!isMirrorReady() || !mZone) {
    updateHud(hud, {
      zoneId: mZone?.id ?? null,
      fps: 1 / dt,
      showFps: getSettings().showFps,
    });
    return;
  }
  // Pause the predicted self while the host has a modal dialogue open —
  // the host pauses its own tick, so any movement the guest predicts now
  // will rubber-band back the instant the host resumes. Gating here also
  // means the on-screen overlay is the only thing reacting to input,
  // which matches what the host sees.
  // Freeze the predicted self while a modal dialogue is open (the host
  // pauses its own tick) or while this guest is dead — a dead guest must
  // neither move nor stream step commits. The guest's own HP lands at
  // playerHealth index 0 via guestSelfHpSync, so that's the death seam here.
  if (!isDialogueOpen() && !isPlayerDead(0)) tickPredictedSelf(dt);
  // Refresh zone.entities with interpolated positions before render.
  // Without this, mobs / pushables / projectiles snap at the broadcaster's
  // 20 Hz tick instead of sliding smoothly. See mirrorWorld.refreshMirrorEntities.
  refreshMirrorEntities();
  const mPlayers = getMirrorPlayers();
  const renderPlayers = buildGuestRenderPlayers(mPlayers);
  if (!renderPlayers.length) {
    updateHud(hud, { zoneId: mZone.id, fps: 1 / dt, showFps: getSettings().showFps });
    return;
  }
  // Follow-self camera: the guest's window tracks the guest's own avatar,
  // so two players can explore different parts of the same zone. This was
  // unsafe before — a guest wandering off-screen drifted into regions the
  // host wasn't simulating — but the host now simulates a viewport per
  // player (simulationViewports), so the guest's surroundings stay live.
  // Falls back to the averaged-live list until the predicted self exists
  // (early session) so the camera never snaps to nowhere.
  const self = getPredictedSelf();
  const camTarget = self ? [self] : liveGuestCameraPlayers(renderPlayers, mPlayers);
  updateCamera(state.camera, camTarget, mZone);
  updateVisibleEntities(mZone, state.camera);
  render(renderer, mZone, state.camera, renderPlayers, biomeAnim.frame);
  updateHud(hud, {
    zoneId: mZone.id,
    fps: 1 / dt,
    showFps: getSettings().showFps,
    player: self,
  });
  // The chip's count is driven by onInventoryChange, but the icon is
  // lazy-painted on the first updateAmmoHud after the inventory sprite
  // sheet loads. Without this call the chip on the guest path renders
  // its number but never gets its icon.
  updateAmmoHud();
}

// Swap the mirror's copy of the guest's own avatar with predictedSelf so
// the local input → render path is round-trip-free. Everyone else stays
// interpolated. The self is placed FIRST so it lands at player[0], which
// render() uses as the deterministic centre for the CantSeeShit light
// cone — with a follow-self camera the cone must track the self, not
// whichever player happened to come first in mirror order.
function buildGuestRenderPlayers(mPlayers) {
  const selfId = getSelfPlayerId();
  const predicted = getPredictedSelf();
  if (!selfId || !predicted) return mPlayers;
  // The predicted self carries no hp/aura (host-authoritative); pull the
  // aura activation progress from the matching mirror entry so the guest
  // sees its own knockback-aura burst play out.
  const mirrorSelf = mPlayers.find((p) => p.playerId === selfId);
  predicted.auraAnim = mirrorSelf ? mirrorSelf.auraAnim : null;
  const out = [predicted];
  for (const p of mPlayers) {
    if (p.playerId !== selfId) out.push(p);
  }
  return out;
}

// Camera input for the guest: the render list minus dead players, so a
// downed co-op partner stops dragging the shared centre toward its
// tombstone. Deadness comes from the mirror's per-player hp (synced by
// the host). The predicted self carries no hp, so we read the self's hp
// from the matching mirror entry by playerId. If everyone's dead we fall
// back to the full list so the camera doesn't snap to nowhere.
function liveGuestCameraPlayers(renderPlayers, mPlayers) {
  const deadIds = new Set();
  for (const p of mPlayers) {
    if (typeof p.hp === "number" && p.hp <= 0) deadIds.add(p.playerId);
  }
  if (!deadIds.size) return renderPlayers;
  const live = renderPlayers.filter((p) => !deadIds.has(p.playerId));
  return live.length ? live : renderPlayers;
}

// Build the co-op second player. Mirrors Rust world_setup.rs's
// spawn_coop_players_around_hero: pickCoopSpawn places P2 on the
// nearest walkable tile to P1, preferring P1's facing direction.
// createPlayer({ index: 1 }) selects the second hero column from the
// heroes sheet so P2 is visually distinct from P1.
function makeCoopP2(p1, zone, opts = {}) {
  const p2 = createPlayer({ index: opts.index ?? 1 });
  const { x: sx, y: sy } = pickCoopSpawn(p1, zone);
  p2.tileX = sx;
  p2.tileY = sy;
  p2.x = sx;
  p2.y = sy;
  p2.direction = "down";
  return p2;
}

// Hot-toggle entry points for the party panel. Spawning / despawning P2
// reuses the same makeCoopP2 helper that initOfflineState calls at boot;
// per-frame consumers (input, melee/shoot/interact, HUD, inventory) all
// already gate on isCoopMode() or state.player2, so the flip takes
// effect on the next tick without further wiring. travelTo re-applies
// the coop spawn rule on zone transitions, so a hot-toggled P2 survives
// teleporters.
// Set the number of LOCAL players sharing this machine (1-4). Spawns or
// despawns avatars to match: P2 stays in state.player2 (kept special);
// P3/P4 are state.players[] entries with playerId:null (the same array
// online guests use, so loop / camera / render / travel / per-slot combat
// all work unchanged — local 4-player is offline-only, so it never shares
// that array with guests). Newly spawned players get full HP; despawned
// players have their input slot cleared.
export function setLocalPlayers(n) {
  if (!state?.zone || !state.player) return;
  n = Math.min(4, Math.max(1, n | 0));
  setLocalPlayerCount(n);

  if (n >= 2 && !state.player2) {
    state.player2 = makeCoopP2(state.player, state.zone, { index: 1 });
    state.lastTile2 = { x: state.player2.tileX, y: state.player2.tileY };
    resetPlayerHealth(1);
  } else if (n < 2 && state.player2) {
    state.player2 = null;
    state.lastTile2 = null;
    clearInputState(2);
  }

  ensureLocalExtra(3, n >= 3);
  ensureLocalExtra(4, n >= 4);
  // Re-derive the split-screen slices + per-slice cameras for the new count
  // (reapplyAutoZoom re-runs the zoom apply, whose onApply calls
  // recomputeSlices) before the HUD re-anchors its bars to the slices.
  reapplyAutoZoom();
  refreshHealthHud();
}

// Spawn/despawn a local P3/P4 entry in state.players. Only ever touches
// entries with playerId == null so online guests (which carry a playerId)
// are never disturbed.
function ensureLocalExtra(slot, want) {
  const idx = slot - 1;
  const existing = state.players.find((e) => e.slot === slot && e.playerId == null);
  if (want && !existing) {
    const p = makeCoopP2(state.player, state.zone, { index: idx });
    state.players.push({ player: p, slot, playerId: null, lastTile: { x: p.tileX, y: p.tileY } });
    resetPlayerHealth(idx);
  } else if (!want && existing) {
    state.players = state.players.filter((e) => !(e.slot === slot && e.playerId == null));
    clearInputState(slot);
  }
}

// Back-compat thin wrappers (party panel / any other callers).
export function enableLocalCoop() { setLocalPlayers(2); }
export function disableLocalCoop() { setLocalPlayers(1); }

// Persist the player's "home" position — but never while in a PvP match.
// The arena (zone 1301) is transient: persisting it would boot the next
// page load straight into the arena instead of the world the player
// actually lives in. PvP exit travels back to the captured pre-match spot
// (pvpController / onlineDeathmatch), so the save can stay frozen at the
// real world through the whole match. Online guests don't reach here (their
// state is wiped); online co-op hosts DO save, so a host keeps the zone they
// walked to during a session.
function persistProgress() {
  if (isPvp()) return;
  saveProgress(state);
}

// Coalesce the high-frequency per-tile-step save. Walking commits a step
// ~4.5×/s, and each saveProgress writes 3-4 storage keys whose change events
// each drive cloudSave to re-serialize + hash the whole save synchronously
// (even when signed out) — ~15 serialize/hash cycles per second of walking.
// Saving the player's tile is cheap to defer: a throttled save (at most once
// per window) bounds the worst-case staleness to ~1s while the
// zone-change and beforeunload paths below stay immediate, so a clean exit or
// teleport never loses position. Matches the original "persist on zone change"
// design intent (see save.js header); per-step was always over-eager.
const POSITION_SAVE_THROTTLE_MS = 1000;
let pendingSaveTimer = null;
function persistProgressThrottled() {
  if (isPvp()) return;
  if (pendingSaveTimer) return; // a save is already scheduled — coalesce into it
  pendingSaveTimer = setTimeout(() => {
    pendingSaveTimer = null;
    persistProgress();
  }, POSITION_SAVE_THROTTLE_MS);
}
// Cancel any pending throttled save and persist the current position now.
// Used by the zone-change and page-unload paths, where the save must land
// immediately (and the just-saved state supersedes whatever was pending).
function flushPendingProgress() {
  if (pendingSaveTimer) { clearTimeout(pendingSaveTimer); pendingSaveTimer = null; }
  persistProgress();
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById("hud");
  if (el) el.textContent = `Error: ${err.message}`;
});
