// The Tower Defense board, built in code (no JSON). Every TD run generates its
// track procedurally over this fixed 46×38 arena: an all-grass field with a
// forest-bordered open interior, a left spawn band (the horde's start) and a
// goal punched through the right edge (the village). This replaces the former
// data/1401.json — generateMap() reads only construction_tiles + td, and
// tdBoard.initBoard reads only td, so this raw-zone object carries exactly the
// fields the TD pipeline consumes (the old marker entity was cosmetic and is
// dropped).
//
// Imports only the constants leaf on purpose: mirrorWorld and towerDefense both
// build the board, and the mirror must stay import-light. tdBaseZone() returns a
// FRESH deep copy each call — callers mutate it (towerDefense.loadMap sets
// rawZone.td.heroSpawns; it also spreads the object then overwrites td).

import { TD_ZONE_ID } from "./constants.js";

const COLS = 46;
const ROWS = 38;

// Open-ground predicate for the arena interior: the main chamber, plus the
// horizontal corridor that opens the left spawn band and punches the goal
// through the right border. Everything else is forest border ('8').
function isOpenTile(x, y) {
  const chamber = y >= 10 && y <= 27 && x >= 10 && x <= 35;
  const corridor = y >= 18 && y <= 20 && x >= 7 && x <= 45;
  return chamber || corridor;
}

function constructionRows() {
  const rows = [];
  for (let y = 0; y < ROWS; y++) {
    let row = "";
    for (let x = 0; x < COLS; x++) row += isOpenTile(x, y) ? "0" : "8";
    rows.push(row);
  }
  return rows;
}

function biomeRows() {
  const rows = [];
  for (let y = 0; y < ROWS; y++) rows.push("1".repeat(COLS));
  return rows;
}

// Enemy spawn band: the 3×3 block in the left corridor opening (y-outer, x-inner,
// matching the order the shipped board listed them).
function spawnTiles() {
  const out = [];
  for (let y = 18; y <= 20; y++) {
    for (let x = 7; x <= 9; x++) out.push({ x, y });
  }
  return out;
}

export function tdBaseZone() {
  return {
    id: TD_ZONE_ID,
    biome_tiles: { sheet_id: 1002, tiles: biomeRows() },
    construction_tiles: { sheet_id: 1003, tiles: constructionRows() },
    world_type: "Exterior",
    soundtrack: null,
    light_conditions: "Day",
    ephemeral_state: true,
    entities: [],
    cutscenes: [],
    td: {
      goal: { x: 45, y: 19 },
      spawns: spawnTiles(),
      heroSpawns: [{ x: 29, y: 18 }, { x: 29, y: 20 }],
    },
  };
}
