import { DrawStreamBits, DrawStreamFlags } from '../../backend/constants.mjs';

const NULL_HANDLE = -1 >>> 0;

export class DrawStream {
  constructor() {
    this.state = (new Uint32Array(32)).fill(NULL_HANDLE);
    this.stream = new Uint32Array(32 * 64 * 1024); // TODO: dynamic resize ?
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

  set_shader(shader_handle) {
    this.upload_data("shader", shader_handle);
  }

  set_globals(group_handle) {
    this.upload_data("bind_group0", group_handle);
  }

  set_variant(group_handle) {
    this.upload_data("bind_group1", group_handle);
  }

  set_material(group_handle) {
    this.upload_data("bind_group2", group_handle);
  }

  set_dynamic(group_handle) {
    this.upload_data("dynamic_group", group_handle);
  }

  set_dynamic_offset(idx, offset) {
    this.upload_data("dynamic_offset0", offset, idx);
  }

  set_attribute(idx, attrib_handle) {
    this.upload_data("attribute0", attrib_handle, idx);
  }

  upload_data(key, data, offset = 0) {
    const bit = DrawStreamBits[key] + offset;
    if (this.state[bit] != data) {
      this.metadata |= 1 << bit;
      this.stream[++this.offset] = data;
      this.state[bit] = data;
    }
  }

  draw(desc = {}) {
    for (let entry of Object.keys(desc))
      this.upload_data(entry, desc[entry]);

    this.count++;
    this.offset++;
    this.stream[this.meta_offset] = this.metadata;
    this.meta_offset = this.offset;
    this.metadata = 0;
  }
}