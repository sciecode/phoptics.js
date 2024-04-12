import { DrawStreamBits, DrawStreamFlags } from '../../backend/constants.mjs';

const NULL_HANDLE = -1 >>> 0;

export class DrawStream {
  constructor() {
    this.state = (new Uint32Array(32)).fill(NULL_HANDLE);
    this.stream = new Uint32Array(32 * 64 * 1024); // TODO: dynamic resize ?
    this.count = 0;
    this.offset = 0;
  }

  clear() {
    this.count = 0;
    this.offset = 0;
    this.state.fill(NULL_HANDLE);
  }

  draw(desc) {
    let metadata = 0, draw_offset = this.offset;

    for (let entry of Object.keys(desc)) {
      const bit = DrawStreamBits[entry], data = desc[entry];
      if (this.state[bit] != data) {
        metadata |= DrawStreamFlags[entry];
        this.stream[++this.offset] = data;
        this.state[bit] = data;
      }
    }

    this.count++;
    this.offset++;
    this.stream[draw_offset] = metadata;
  }
}