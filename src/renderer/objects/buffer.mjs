import { UNINITIALIZED } from "../constants.mjs";

export class Buffer {
  #id = UNINITIALIZED;
  #version = 0;
  #free = () => {}

  constructor(options) {
    this.data = options.data;
    this.stride = options.stride || 4;
    this.total_bytes = this.data.byteLength;
  }

  get_id() { return this.#id; }
  get_version() { return this.#version; }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free; } }
  destroy() { this.#free(this.#id); this.#id = -1 }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}