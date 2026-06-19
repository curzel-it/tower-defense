// The programmatic Tower Defense board (replaces data/1401.json). Proves the
// raw-zone shape the TD pipeline consumes, that each call is an isolated deep
// copy (callers mutate it), that generateMap still routes a solvable path over
// it, and that buildZone treats the interior as walkable and the border as not.

import { test } from "node:test";
import assert from "node:assert/strict";

import { tdBaseZone } from "../js/tdBoardData.js";
import { TD_ZONE_ID } from "../js/constants.js";
import { generateMap } from "../js/tdMaze.js";
import { buildZone, isWalkable } from "../js/zone.js";
import { computeFlowField, allReachable } from "../js/flowField.js";
import { loadSpeciesData } from "../js/species.js";

loadSpeciesData([]);

const key = (x, y) => `${x},${y}`;

test("shape — 46×38 all-grass arena with the TD metadata", () => {
  const z = tdBaseZone();
  assert.equal(z.id, TD_ZONE_ID);
  assert.equal(z.biome_tiles.tiles.length, 38, "38 rows");
  assert.equal(z.biome_tiles.tiles[0].length, 46, "46 cols");
  assert.ok(z.biome_tiles.tiles.every((r) => /^1+$/.test(r)), "biome is all grass");
  assert.equal(z.construction_tiles.tiles.length, 38);
  assert.equal(z.td.spawns.length, 9, "3×3 enemy spawn band");
  assert.equal(z.td.heroSpawns.length, 2, "two hero starts");
  assert.deepEqual(z.td.goal, { x: 45, y: 19 });
});

test("purity — each call is an isolated deep copy", () => {
  const a = tdBaseZone();
  const b = tdBaseZone();
  assert.notEqual(a, b, "distinct objects");
  assert.notEqual(a.td, b.td, "distinct td blocks");
  // towerDefense.loadMap mutates td.heroSpawns on the returned object.
  a.td.heroSpawns = [{ x: 1, y: 1 }];
  a.td.spawns.push({ x: 0, y: 0 });
  assert.equal(b.td.heroSpawns.length, 2, "mutation does not leak to the next call");
  assert.equal(b.td.spawns.length, 9);
});

test("playability — generateMap routes a path that reaches the goal", () => {
  const raw = tdBaseZone();
  const { path, heroSpawns } = generateMap(raw, 0);
  for (const s of raw.td.spawns) {
    assert.ok(path.has(key(s.x, s.y)), `enemy spawn ${s.x},${s.y} on the path`);
  }
  assert.ok(path.has(key(raw.td.goal.x, raw.td.goal.y)), "goal on the path");
  const grid = { cols: 46, rows: 38, isBlocked: (x, y) => !path.has(key(x, y)) };
  const field = computeFlowField(grid, raw.td.goal);
  assert.ok(allReachable(field, raw.td.spawns), "every spawn reaches the goal along the path");
  assert.equal(heroSpawns.length, 2);
});

test("buildZone compat — interior walkable, forest border not", () => {
  const zone = buildZone(tdBaseZone());
  assert.ok(isWalkable(zone, 22, 19), "open interior is walkable");
  assert.ok(!isWalkable(zone, 0, 0), "forest border blocks");
});
