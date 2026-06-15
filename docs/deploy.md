# Deploy

This game ships to **<https://towerdefense.curzel.it>** from a shared Ubuntu VPS
via `npm run deploy` (`node tools/deploy.mjs` — ssh2-based, idempotent).

```bash
npm run deploy                      # build + ship the current tree
npm run deploy -- --commit "msg"    # commit + push + deploy in one shot
```

## Three services, one VPS

The same VPS hosts three **independent** sites side by side:

| Service | Domain | systemd unit | user | `/opt` dir | webroot | loopback port |
|---|---|---|---|---|---|---|
| Restart Borgo | restartborgo.it | (its own repo) | — | — | — | (its own) |
| SneakBit | sneakbit.curzel.it | `sneakbit-server` | `sneakbit` | `/opt/sneakbit-server` | `/var/www/sneakbit` | 8090 |
| **Tower Defense** | **towerdefense.curzel.it** | `towerdefense-server` | `towerdefense` | `/opt/towerdefense-server` | `/var/www/towerdefense` | **8091** |

Coexistence is purely by **namespacing** — every host-side resource this deploy
touches is keyed off the constants at the top of `tools/deploy.mjs`
(`APP_NAME`, `APP_USER`, `APP_BIND_PORT`, `SERVER_NAME`, `WEBROOT`):

- **nginx vhost** is written to `/etc/nginx/sites-available/<SERVER_NAME>` and
  symlinked into `sites-enabled/` — the filename *is* the domain, so this deploy
  only ever writes/reads its own vhost and never clobbers a co-tenant's.
- **TLS**: `certbot --nginx -d <SERVER_NAME>` issues/installs a cert for this
  domain only.
- **systemd unit / user / `/opt` / `/var/www`** are all `towerdefense*`, distinct
  from the SneakBit set.
- **loopback port** is 8091 (SneakBit is 8090) so the two Node relays don't
  collide; nginx reverse-proxies `/ws` + the JSON endpoints to it.
- The only file shared across vhosts is `/etc/nginx/conf.d/connection_upgrade.conf`
  (the WebSocket `Connection: upgrade` map). Each deploy rewrites it with
  identical content — harmless and idempotent.

To stand up a *new* service on this VPS, copy this repo's deploy and change those
same constants (and pick a fresh port + domain).

## Prerequisites (first deploy)

1. **DNS** — an `A` record for `towerdefense.curzel.it` pointing at the VPS
   (`IP_ADDRESS` in `.env`) **before** the first deploy, or certbot can't issue
   the cert.
2. **`.env`** — `IP_ADDRESS`, the SSH creds the deploy uses, `CERTBOT_EMAIL`, and
   any server secrets (see `tools/deploy.mjs`). Never committed.
3. **TURN** (optional, for online co-op beyond STUN) — coturn is shared VPS infra;
   set `TURN_SECRET` / `TURN_URLS` in `.env` and they're written to
   `/etc/towerdefense-server.env` (the unit's `EnvironmentFile`). See the TURN
   block in `tools/deploy.mjs` for the coturn setup.

## What a deploy does

Installs nginx + certbot + Node (if missing), creates the `towerdefense` user and
`/opt/towerdefense-server`, pushes `server/`, builds the client (`_site/`) and
pushes it to `/var/www/towerdefense`, writes the systemd unit + nginx vhost,
provisions TLS, restarts the unit, reloads nginx, then health-checks the live
URLs (service active, `/health`, the landing + `/play/` over HTTPS, a real
WebSocket `101` upgrade, and that `/version` carries the just-deployed git SHA).
A failed health check rolls the client + server back to the previous snapshot.
