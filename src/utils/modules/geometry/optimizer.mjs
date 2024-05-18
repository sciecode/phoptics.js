import { opt_remap } from "./optimizer/remap.mjs";
import { opt_cache } from "./optimizer/cache.mjs";
import { opt_fetch } from "./optimizer/fetch.mjs";

const optimize_geometry = (geometry) => {
  opt_remap(geometry);
  opt_cache(geometry);
  opt_fetch(geometry);
}

export { optimize_geometry, opt_remap, opt_cache, opt_fetch };