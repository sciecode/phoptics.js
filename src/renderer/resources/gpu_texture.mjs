
export class GPUTexture {
  #version = 0;
  constructor(id, size, format) {
    this.id = id;
    this.size = size;
    this.format = format;
  }
  
  update() { this.#version++ }
  get_version() { return this.#version }
}