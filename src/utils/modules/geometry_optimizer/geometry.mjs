export class Geometry {
  
  constructor() {
    this.indices = null;
    this.vertex_count = null;
    this.attributes = new Map();
    this.buffers = [];
    this.groups = [];
  }

  set_indices(typed) {
    this.indices = typed;
  }

  add_buffer(typed) {
    const idx = this.buffers.length;
    this.buffers.push( 
      (typed instanceof Uint8Array) ? 
        typed : new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength)
    );
    return idx;
  }

  add_group(offset, count) {
    const group = { offset: offset, count: count };
    this.groups.push(group);
  }

  add_attribute(name, buffer_id, type, count, stride, offset) {

    const buffer_length = this.buffers[buffer_id].length;
    const vcount = buffer_length / stride;

    if (!Number.isInteger(vcount))
      throw new Error(`Geometry.add_attribute: buffer length not multiple of stride.`)

    if (this.vertex_count) {
      if (this.vertex_count != vcount)
        throw new Error(`Geometry.add_attribute: '${name}' attribute incompatible vertex count.`)
    } else {
      this.vertex_count = vcount;
    }

    const entry = {
      name: name,
      buffer_id: buffer_id,
      type: type,
      count: count,
      stride: stride,
      offset: offset
    }
    this.attributes.set(entry.name, entry);
  }

  remove_attribute(entry) {
    this.attributes.delete(entry.name);
  }
}