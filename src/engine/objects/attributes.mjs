
import { UNINITIALIZED } from "../constants.mjs";

export class Attributes {
  #bid = UNINITIALIZED;
  #binding = 0;
  #layout = 0;
  #vertex_offset = 0;
  #instance_offset = 0;
  #free = () => {}

  constructor(options) {
  }
  
  get_bid() { return this.#bid; }
  initialize(bid, binding, layout, vert_offset, inst_offset) { 
    if (this.#bid == UNINITIALIZED) {
      this.#bid = bid;
      this.#binding = binding;
      this.#layout = layout;
      this.#vertex_offset = vert_offset;
      this.#instance_offset = inst_offset;
      // this.#free = free;
    }
  }
  destroy() {
    for (let entry of this.info) entry.ownership && this[entry.name].destroy();
    this.#free(this.#bid);
    this.#bid = -1;
  }
}