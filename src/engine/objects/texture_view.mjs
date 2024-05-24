import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class TextureView {
  #id = UNINITIALIZED;
  constructor(options) {
    this.type = ResourceType.TextureView;
    this.texture = options.texture;
    this.info = options.info;
  }
  get_id() { return this.#id; }
  initialize(id) { if (this.#id == UNINITIALIZED) { this.#id = id } }
}