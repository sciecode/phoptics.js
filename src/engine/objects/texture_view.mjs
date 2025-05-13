import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class TextureView {
  #id = UNINITIALIZED;
  #free = () => {};
  constructor(options) {
    this.type = ResourceType.TextureView;
    this.texture = options.texture;
    this.info = options.info;
  }
  get_id() { return this.#id; }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free; } }
  destroy() { this.#free(this.#id); }
}