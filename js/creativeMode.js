// Creative mode was removed when the project forked into Tower Defense (the
// SneakBit map-editor / sandbox is gone). This stub keeps the predicate other
// modules still call returning false in production; the remaining `if
// (isCreativeMode())` branches are dead and get trimmed in a cleanup pass. The
// test override is retained so the few tests that still exercise those branches
// keep working until then.

let cached = null;

export function isCreativeMode() {
  return cached === true;
}

// Test hook: lets tests force the predicate to a known value.
export function _setCreativeModeForTesting(v) {
  cached = !!v;
}
