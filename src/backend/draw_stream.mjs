
const METADATA_BITS = 13;
export const NULL_HANDLE = -1 >>> 0;

export const BITS = {
  shader:       0,  // size: 1
  bind_group:   1,  // size: 3
  vertex:       4,  // size: 8
  index:        12, // size: 1
}

export class DrawStream {
  constructor() {
    this.state = (new Uint32Array(32)).fill(NULL_HANDLE);
    this.buffer = new Uint32Array(32 * 64 * 1024);
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

  set_vertex(idx, handle) {
    this.validate(BITS.vertex + idx, handle);
  }

  set_index(handle) {
    this.validate(BITS.index, handle);
  }
  
}