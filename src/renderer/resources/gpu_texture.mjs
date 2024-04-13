import { ResourceType } from "../constants.mjs";

export class GPUTexture {
  #version = 0;
  constructor(id, size, format) {
    this.id = id;
    this.type = ResourceType.GPUTexture;
    this.size = size;
    this.format = format;
  }

  set_size(size) {
    this.size = {...size};
    this.update();
  }
  
  update() { this.#version++ }
  get_version() { return this.#version }
}