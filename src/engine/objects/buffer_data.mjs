import { Buffer } from './buffer.mjs';

export class BufferData {
  #update = undefined;
  constructor(options) {
    this.stride = options.stride || 4;
    this.offset = options.offset || 0;
    this.data = options.data;
    this.ownership = false;
    if (options.buffer) {
      this.buffer = options.buffer;
    } else {
      this.buffer = new Buffer(this.data.byteLength);
      this.ownership = true;
    }
    this.update();
  }
  update(options = {}) { 
    const offset = options.offset || 0;
    const elements = ArrayBuffer.isView(this.data) ? this.data.length : this.data.byteLength;
    const size = options.size || (elements - offset);
    this.#update = { offset, size, data: this.data };
  }
  has_update() {
    const cur = this.#update;
    this.#update = undefined;
    return cur;
  }
  destroy() { if (this.ownership) this.buffer.destroy(); }
}