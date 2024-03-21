
const METADATA_BITS = 16;
export const NULL_HANDLE = 1 << 31;

export const BITS = {
  shader:         0,  // size: 1
  bind_group:     1,  // size: 3
  attribute:      4,  // size: 8
  index:          12, // size: 1
  draw_count:     13, // size: 1
  vertex_offset:  14, // size: 1
  index_offset:   15, // size: 1
}

export class DrawStream {
  constructor() {
    this.state = (new Int32Array(32)).fill(NULL_HANDLE);
    this.buffer = new Int32Array(32 * 64 * 1024);
    this.count = 0;
    this.offset = 0;
  }

  reset() {
    this.offset = 0;
    this.count = 0;
    this.buffer[0] = 0;
    this.state.fill(NULL_HANDLE);
  }

  validate(bit, handle) {
    if (this.state[bit] != handle) {
      this.buffer[this.offset] |= 1 << bit;
      this.state[bit] = handle;
    }
  }

  commit() {
    const metadata = this.buffer[this.offset];

    for (let i = 0; i < METADATA_BITS; i++)
      if (metadata & (1 << i))
        this.buffer[++this.offset] = this.state[i];
    
    this.count++;
    
    // reset next metadata
    this.buffer[++this.offset] = 0;
  }

  set_shader(handle) {
    this.validate(BITS.shader, handle);
  }

  set_bind_group(idx, handle) {
    this.validate(BITS.bind_group + idx, handle);
  }

  set_attribute(idx, handle) {
    this.validate(BITS.attribute + idx, handle);
  }

  set_index(handle) {
    this.validate(BITS.index, handle);
  }

  set_draw_count(val) {
    this.validate(BITS.draw_count, val);
  }

  set_vertex_offset(val) {
    this.validate(BITS.vertex_offset, val);
  }

  set_index_offset(val) {
    this.validate(BITS.index_offset, val);
  }
  
}