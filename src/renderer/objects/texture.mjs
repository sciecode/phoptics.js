import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class Texture {
  #id = UNINITIALIZED;
  #version = 0;
  #free = () => {}

  constructor(options) {
    this.type = ResourceType.Texture;
    this.size = { ...options.size };
    this.format = options.format;
    this.usage = options.usage;
    this.multisampled = options.multisampled || false;
  }

  set_size(size) {
    this.size = { ...size };
    this.#update();
  }

  get_id() { return this.#id; }
  get_version() { return this.#version }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free } }
  destroy() { this.#free(this.#id); this.#id = -1; }
  #update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}