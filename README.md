# Tower Defense

### [Play it now, no install](https://towerdefense.curzel.it)

A co-op **tower defense** game: a team of heroes defends a path against waves of
monsters. Shape the maze in the build phase, then hold the line — buy ammo,
weapons and consumables, recruit and revive heroes, and survive increasingly
hard maps.

It's **forked from [SneakBit](https://github.com/curzel-it/sneakbit)** (a
top-down pixel-art adventure) and built on its HTML5/Canvas engine — but it's now
its own game. The SneakBit adventure lives in its original repo; this one is
tower defense only.

## Features

* Build phase (push stones to maze the path) → wave phase (fight the horde) → clear → repeat
* A squad of distinct heroes (melee chargers + ranged shooters) with switchable possession and AI allies
* Finite ammo + an in-run shop economy (coins from kills buy ammo, weapons, consumables)
* Local split-screen co-op and **online co-op** over WebRTC (host-authoritative)
* Keyboard and gamepad/controller support
* Per-run, transient save — a run never touches a persistent profile

## Running it

No build step for development — serve the folder with any static HTTP server
(browsers block `fetch` on `file://`) and it loads the raw ES modules straight
from `js/`:

```bash
npm run serve            # node tools/serve.mjs (port 8000)
# or
npx http-server -p 8000
```

Then open <http://localhost:8000>.

Production *is* bundled: `npm run build` (esbuild, the only devDependency) writes
a content-hashed single-file bundle into `_site/`. That's what ships — the public
build at <https://towerdefense.curzel.it> is deployed from the VPS via
`npm run deploy`. Dev and the e2e harness never touch the bundle; only deploys do.

## Tests

```bash
npm run test:unit        # fast inner loop (~2 s) - node --test
npm run test:e2e         # full e2e suite (needs Chrome)
npm test                 # both, sequential
```

Tests have no dependencies of their own — unit tests use Node's built-in test
runner. E2E tests drive headless Chrome via raw CDP and self-skip if Chrome isn't
on the path.

## Credits

* Forked from [SneakBit](https://github.com/curzel-it/sneakbit) by [Federico Curzel](https://github.com/curzel-it)
* Music by [Filippo Vicarelli](https://www.filippovicarelli.com/8bit-game-background-music)
* Sound effects by [SubspaceAudio](https://opengameart.org/content/512-sound-effects-8-bit-style)
* Font by [HarvettFox96](https://dl.dafont.com/dl/?f=pixel_operator)

## License

[MIT](./LICENSE) for the code in this repo. Third-party assets keep their original licenses (see Credits above).
