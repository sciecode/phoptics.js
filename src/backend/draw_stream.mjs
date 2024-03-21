const NULL_HANDLE = -1 >>> 0;

const Bits = {
  shader:         0,
  bind_group0:    1,
  bind_group1:    2,
  bind_group2:    3,
  attribute0:     4,
  attribute1:     5,
  attribute2:     6,
  attribute4:     7,
  index:          8,
  draw_count:     9,
  vertex_offset:  10,
  index_offset:   11,
}

export const DrawStreamFlags = {
  shader:         1,
  bind_group0:    2,
  bind_group1:    4,
  bind_group2:    8,
  attribute0:     16,
  attribute1:     32,
  attribute2:     64,
  attribute4:     128,
  index:          256,
  draw_count:     512,
  vertex_offset:  1024,
  index_offset:   2048,
}

export class DrawStream {
  constructor() {
    this.state = (new Uint32Array(32)).fill(NULL_HANDLE);
    this.stream = new Uint32Array(32 * 64 * 1024);
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

    for (let entry of Object.keys(Bits)) {
      const bit = Bits[entry], data = desc[entry];
      if (data !== undefined && this.state[bit] != data) {
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