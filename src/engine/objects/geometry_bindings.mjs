import { Buffer } from './buffer.mjs';

class GeometryBinding {
  #update = undefined;
  constructor(options) {
    this.data = options.data;
    this.stride = options.stride || 4;
    this.buffer = new Buffer(options.size || this.data.byteLength);
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
  destroy() { this.buffer.destroy(); }
}

export class Index extends GeometryBinding {}
export class Vertex extends GeometryBinding {}