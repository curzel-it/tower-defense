// Loads and caches JSON data (levels, species). Pure I/O — no game logic.

const cache = new Map();

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

export async function loadZone(id) {
  const key = `zone:${id}`;
  if (cache.has(key)) return cache.get(key);
  const raw = await fetchJson(`./data/${id}.json`);
  cache.set(key, raw);
  return raw;
}

export async function loadSpecies() {
  const key = "species";
  if (!cache.has(key)) cache.set(key, await fetchJson("./data/species.json"));
  return cache.get(key);
}

export async function loadStrings(lang = "en") {
  const key = `strings:${lang}`;
  if (!cache.has(key)) cache.set(key, await fetchJson(`./data/strings.${lang}.json`));
  return cache.get(key);
}
