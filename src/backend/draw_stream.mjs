const NULL_HANDLE = -1 >>> 0;

const Bits = {
  shader:           0,
  bind_group0:      1,
  bind_group1:      2,
  bind_group2:      3,
  dynamic_group:    4,
  dynamic_offset0:  5,
  dynamic_offset1:  6,
  dynamic_offset2:  7,
  dynamic_offset3:  8,
  attribute0:       9,
  attribute1:       10,
  attribute2:       11,
  attribute4:       12,
  index:            13,
  draw_count:       14,
  vertex_offset:    15,
  index_offset:     16,
}

export const DrawStreamFlags = {
  shader:           1,
  bind_group0:      2,
  bind_group1:      4,
  bind_group2:      8,
  dynamic_group:    16,
  dynamic_offset0:  32,
  dynamic_offset1:  64,
  dynamic_offset2:  128,
  dynamic_offset3:  256,
  attribute0:       512,
  attribute1:       1024,
  attribute2:       2048,
  attribute4:       4096,
  index:            8192,
  draw_count:       16384,
  vertex_offset:    32768,
  index_offset:     65536,
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