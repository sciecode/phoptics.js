import { ResourceType, UNINITIALIZED } from "../constants.mjs";

export class StructuredBuffer {
  #id = UNINITIALIZED;
  #version = 0;

  constructor(options) {
    this.type = ResourceType.StructuredBuffer;
    this.total_bytes = 0;

    for (let entry of options) this.total_bytes += entry.type.byte_size;
    this.buffer = new ArrayBuffer(this.total_bytes);
    
    let current_offset = 0;
    for (let entry of options) {
      this[entry.name] = new entry.type(this.buffer, current_offset);
      current_offset += entry.type.byte_size;
    }
  }

  get_id() { return this.#id }
  get_version() { return this.#version }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED }
}