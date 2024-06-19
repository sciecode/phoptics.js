import { UNINITIALIZED } from "../constants.mjs";

export class Buffer {
  #id = UNINITIALIZED;
  #bid = UNINITIALIZED;
  #free = () => {}

  constructor(size) { this.size = size; }
  get_id() { return this.#id; }
  get_bid() { return this.#bid }
  initialize(id, bid, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#bid = bid; this.#free = free; } }
  destroy() { this.#free(this.#id); this.#id = -1 }
}