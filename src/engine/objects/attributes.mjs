
import { UNINITIALIZED } from "../constants.mjs";

export class Attributes {
  #bid = UNINITIALIZED;
  #binding = 0;
  #layout = 0;
  #vertex_offset = 0;
  #instance_offset = 0;
  #free = () => {}

  constructor(entries) {
    this.entries = entries;
  }
  
  get_bid() { return this.#bid; }
  initialize(bid, binding, layout, vert_offset, inst_offset, free) { 
    if (this.#bid == UNINITIALIZED) {
      this.#bid = bid;
      this.#binding = binding;
      this.#layout = layout;
      this.#vertex_offset = vert_offset;
      this.#instance_offset = inst_offset;
      this.#free = free;
    }
  }
  destroy() {
    this.#free(this.#bid);
    this.#bid = -1;
  }
}