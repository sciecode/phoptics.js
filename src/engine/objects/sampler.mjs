import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class Sampler {
  #id = UNINITIALIZED;

  constructor(options = {}) {
    this.type = ResourceType.Sampler;
    this.address = {
      u: options.address?.u || "clamp-to-edge",
      v: options.address?.v || "clamp-to-edge",
      w: options.address?.w || "clamp-to-edge",
    };
    this.filtering = {
      min: options.filtering?.min || "nearest",
      mag: options.filtering?.mag || "nearest",
      mip: options.filtering?.mip || "nearest",
    };
  }

  get_id() { return this.#id; }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
}