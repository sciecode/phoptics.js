import { Buffer } from './buffer.mjs';

// TODO: handle buffer offset / data offset - src/dst uploads

export class BufferMap {
  #update = true;
  constructor(options) {
    this.stride = options.stride || 4;
    this.offset = options.offset || 0;
    this.data = options.data;
    this.ownership = false;
    if (options.buffer) {
      this.buffer = options.buffer;
      this.size = options.size || options.buffer.size;
    } else {
      this.buffer = new Buffer(options.size);
      this.size = options.size;
      this.ownership = true;
    }
  }
  update() { this.#update = true; }
  has_updated() {
    const cur = this.#update;
    this.#update = !cur;
    return cur;
  }
  destroy() { if (this.ownership) this.buffer.destroy(); }
}