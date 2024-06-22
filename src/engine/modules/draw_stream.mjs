import { DrawStreamBits, DrawStreamFlags, NULL_HANDLE } from '../../backend/constants.mjs';

export class DrawStream {
  constructor() {
    this.state = (new Int32Array(32)).fill(NULL_HANDLE);
    this.stream = new Int32Array(32 * 64 * 1024);
    this.count = 0;
    this.offset = 0;
    this.metadata = 0;
    this.meta_offset = 0;
  }

  clear() {
    this.count = 0;
    this.offset = 0;
    this.metadata = 0;
    this.meta_offset = 0;
    this.state.fill(NULL_HANDLE);
  }

  set_pipeline(pipeline_handle) {
    this.upload_data(DrawStreamBits.pipeline, DrawStreamFlags.pipeline, pipeline_handle);
  }

  set_globals(group_handle) {
    this.upload_data(DrawStreamBits.bind_globals, DrawStreamFlags.bind_globals, group_handle);
  }
  
  set_material(group_handle) {
    this.upload_data(DrawStreamBits.bind_material, DrawStreamFlags.bind_material, group_handle);
  }

  set_geometry(group_handle) {
    this.upload_data(DrawStreamBits.bind_geometry, DrawStreamFlags.bind_geometry, group_handle);
  }

  set_dynamic(group_handle) {
    this.upload_data(DrawStreamBits.dynamic_group, DrawStreamFlags.dynamic_group, group_handle);
  }

  set_dynamic_offset(offset) {
    this.upload_data(DrawStreamBits.dynamic_offset, DrawStreamFlags.dynamic_offset, offset);
  }

  upload_data(bit, flag, data) {
    if (this.state[bit] != data) {
      this.metadata |= flag;
      this.state[bit] = data;
    }
  }

  draw(desc = {}) {
    for (let entry of Object.keys(desc))
      this.upload_data(DrawStreamBits[entry], DrawStreamFlags[entry], desc[entry]);

    for (let bit = 0, il = DrawStreamBits.MAX; bit < il; bit++)
      if (this.metadata & (1 << bit)) this.stream[++this.offset] = this.state[bit];

    this.count++;
    this.offset++;
    this.stream[this.meta_offset] = this.metadata;
    this.meta_offset = this.offset;
    this.metadata = 0;
  }
}