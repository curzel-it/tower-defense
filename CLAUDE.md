# Hello Claude!

This is a co-op **Tower Defense** game: a team of heroes defends a path against
waves of monsters. HTML5 / Canvas / vanilla JS.

It was **forked from [SneakBit](https://github.com/curzel-it/sneakbit)** — a
top-down pixel-art adventure — and reuses its engine (rendering, tiles/biomes,
player, combat, input, online co-op). The SneakBit adventure (story, zones,
quests, NPCs) is being stripped out; this repo is now its own tower-defense
game and does **not** aim to stay compatible with SneakBit. The original game
lives on in its own repo.

## Handling a Task
1. For non-trivial tasks, use the built-in plan mode to create a plan before implementing
2. Ask me any questions on things that are uncertain about the plan (when necessary)
3. Implement, run the unit tests, and verify visually in the browser
4. Review and cleanup, remove unnecessary comments
5. Commit and push (see below)
6. Enjoy!

## The game
- **Modes:** solo, local split-screen co-op, and online co-op (host-authoritative
  over WebRTC). There is no longer a single-player adventure, PvP, or creative mode.
- **The loop:** a build phase (push stones to shape the maze) → a wave phase
  (fight the horde marching the path) → clear → repeat, on increasingly hard maps.
- **Economy:** the run uses the game's coins in a transient per-run save
  (`tdSave.js`) — never the real wallet. Ammo is finite; coins buy ammo, weapons
  and consumables from the in-run shop (`tdShopStock.js`), and recruit/revive heroes.
- **Key files:** `towerDefense.js` (controller + frame), `tdBoard.js`, `tdMaze.js`,
  `tdWaves.js`, `tdEnemies.js`, `tdHud.js`, `tdShopStock.js`, `tdSave.js`,
  `heroSwitch.js`, `allyAI.js`. The boot (`main.js`) starts a TD run directly.

## Testing, committing, shipping
- **Unit tests** use Node's built-in test runner — no framework. Tests live in `tests/` and end in `.test.js`. They are pure node, no DOM, ~2 s to run, and need no install. (The repo's one devDependency, esbuild, is for the production build only — see "No build step" below.)
- **E2E tests** live in `tests/e2e/*.test.mjs`. They drive headless Chrome via raw CDP and exercise the live game end-to-end. They self-skip if Chrome isn't on the path; set `CHROME_PATH` to point at a non-default install.
- Commands:
  ```bash
  npm run test:unit   # fast inner loop (~2 s)
  npm run test:e2e    # full e2e suite (needs Chrome)
  npm test            # both, sequential
  ```
  Run `test:unit` often — at minimum before each commit.
- **Commit often.** Small focused commits beat large ones. Each commit should leave the game in a runnable state (`npm test` green, page loads without console errors).
- **Push to main often.** Pushing to `main` is *not* a release on its own. Production is <https://towerdefense.curzel.it>, served from the VPS, and only goes live when you run `npm run deploy` (which builds + ships the client). So keep `main` healthy and push freely; ship to users explicitly with `npm run deploy` (or `npm run deploy -- --commit "msg"` to commit + push + deploy in one shot).

## Server (`server/`)
- The Node server lives in `server/` — vanilla `node:http`, no deps, ES modules, same "one feature one file" rule as the client. Run locally with `node server/index.js`. `GET /health` returns 200 "ok" — keep that endpoint cheap.
- Production lives at <https://towerdefense.curzel.it> on a shared Ubuntu VPS that also serves sneakbit.curzel.it and restartborgo.it (IP in `.env` as `IP_ADDRESS`). systemd unit `towerdefense-server`, nginx reverse proxy, TLS via certbot. See `docs/deploy.md` for how the three services coexist.
- Deploy with `npm run deploy` (i.e. `node tools/deploy.mjs` — ssh2-based, idempotent). `npm run deploy -- --commit "msg"` to commit + push + deploy in one shot.

## Style and Guidelines
- **No build step for development.** Open `index.html` (or serve the folder with any static server) and reload — dev and the e2e harness load the raw ES modules straight from `js/`. Production is the exception: `npm run build` (esbuild, the only devDependency) bundles the module graph into a content-hashed single file under `_site/` for deploy — see `tools/build.mjs`. Don't add a build dependency for the dev loop.
- **Coordinate system:** world space is in tiles (floats). Screen space is in pixels. Conversion happens in the renderer only.
- **No external runtime libraries** unless we hit a real wall. Canvas 2D is enough for now. (esbuild is a build-time tool, not shipped to the browser; it doesn't count.)
- **Pixel art:** disable image smoothing on the 2D context (`ctx.imageSmoothingEnabled = false`) and round draw coordinates to integers before blitting.
- **Naming:** files in `js/` are camelCase, matching the feature name. Exports are named, never default.
- **One feature one file**
- if it's a UI thing, don't implement it in the canvas (buttons, icons, counters, dialogues, ...)

## Architecture — one feature, one file
Each feature lives in exactly one file. A "feature" is a single, self-contained responsibility — input handling, the player, the camera, the renderer, the game loop, etc. If a file starts handling more than one feature, split it. If two features keep reaching into each other, push the shared bit into its own file rather than fusing them.

- Files are vanilla ES modules. Plain `<script type="module">` from `index.html`. No bundler, no transpiler, no framework.
- Cross-feature communication happens through explicit imports of named exports — no globals, no event bus until we genuinely need one.
- Feature-local constants live in the feature file. Truly cross-cutting constants (tile size, sprite-sheet ids) live in `js/constants.js`.
- Asset loading is its own feature (`js/assets.js`). Data loading (levels, species) is its own feature (`js/data.js`). Features ask them by name; they never new up `Image` or `fetch` themselves.

> **Note:** this codebase still carries dormant SneakBit engine modules (adventure/quests/NPCs) that the TD build no longer reaches. They're being removed in batches; don't wire new TD features through them.
