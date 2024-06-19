import { Buffer } from './buffer.mjs';

export class BufferBinding {
  #update = undefined;
  constructor(options) {
    this.data = options.data;
    this.stride = options.stride || 4;
    this.offset = options.offset || 0;
    if (options.buffer) {
      this.ownership = false;
      this.buffer = options.buffer;
    } else {
      this.ownership = true;
      this.buffer = new Buffer(options.size || this.data.byteLength);
    }
    if (this.data) this.update();
  }
  update(options = {}) { 
    const offset = options.offset || 0;
    const data = options.data || this.data;
    const elements = ArrayBuffer.isView(data) ? data.length : data.byteLength;
    const size = options.size || (elements - offset);
    this.#update = { offset, size, data: data };
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
  destroy() { if (this.ownership) this.buffer.destroy(); }
}