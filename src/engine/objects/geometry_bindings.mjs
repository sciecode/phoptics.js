import { UNINITIALIZED } from "../constants.mjs";

class GeometryBinding {
  #id = UNINITIALIZED;
  #bid = UNINITIALIZED;
  #update = undefined;
  #free = () => {}
  constructor(options) {
    this.data = options.data;
    this.stride = options.stride || 4;
    this.size = options.size || this.data.byteLength;
    if (this.data) this.update();
  }
  update(options = {}) {
    const buffer_offset = options.buffer_offset || 0;
    const data = options.data || this.data;
    const data_offset = options.data_offset || 0;
    const elements = ArrayBuffer.isView(data) ? data.length : data.byteLength;
    const size = options.size || (elements - data_offset);
    this.#update = { data_offset, buffer_offset, size, data: data };
    return this;
  }
  free_storage() {
    this.data = undefined;
    return this;
  }
  has_update() {
    const cur = this.#update;
    this.#update = undefined;
    return cur;
  }
  get_id() { return this.#id; }
  get_bid() { return this.#bid }
  initialize(id, bid, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#bid = bid; this.#free = free; } }
  destroy() { this.#free(this.#id); this.#id = -1 }
}

export class Index extends GeometryBinding {}
export class Vertex extends GeometryBinding {}