import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class StructuredBuffer {
  #id = UNINITIALIZED;
  #version = 0;

  constructor(options) {
    this.type = ResourceType.StructuredBuffer;
    
    const arr = [];
    this.total_bytes = parse_struct(this, arr, options);
    this.buffer = new ArrayBuffer(this.total_bytes);

    let current_offset = 0;
    for (let entry of arr) {
      entry.parent[entry.name] = new entry.type(this.buffer, current_offset);
      current_offset += entry.size;
    }
  }

  get_id() { return this.#id }
  get_version() { return this.#version }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED }
}

const parse_struct = (parent, arr, desc) => {
  let total_bytes = 0;
  for (let entry of desc) {
    if (typeof entry.type == 'function') {
      if (!entry.count || entry.count < 2) {
        total_bytes += entry.type.byte_size;
        arr.push( { parent: parent, name: entry.name, type: entry.type, size: entry.type.byte_size } );
      } else {
        const par = parent[entry.name] = [];
        for (let i = 0; i < entry.count; i++) {
          total_bytes += entry.type.byte_size;
          arr.push( { parent: par, name: i, type: entry.type, size: entry.type.byte_size } );
        }
      }
    } else {
      if (!entry.count || entry.count < 2) {
        parent[entry.name] = {};
        total_bytes += parse_struct(parent[entry.name], arr, entry.type);
      } else {
        const par = parent[entry.name] = [];
        for (let i = 0; i < entry.count; i++) {
          par[i] = {};
          total_bytes += parse_struct(par[i], arr, entry.type);
        }
      }
    }
  }

  return total_bytes;
}