import { UNINITIALIZED } from "../constants.mjs";

export class Buffer {
  #id = UNINITIALIZED;
  #bid = UNINITIALIZED;
  #version = 0;
  #free = () => {}

  constructor(options) {
    this.data = options.data;
    this.stride = options.stride || 4;
    this.total_bytes = options.bytes || this.data.byteLength;
    this.offset = options.offset || 0;
  }

  get_id() { return this.#id; }
  get_version() { return this.#version; }
  get_bid() { return this.#bid }
  initialize(id, bid, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#bid = bid; this.#free = free; } }
  destroy() { this.#free(this.#id); this.#id = -1 }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}