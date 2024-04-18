import { UNINITIALIZED } from "../constants.mjs";
import { build_bindings } from "../common/bindings.mjs";

export class Material {
  #id = UNINITIALIZED;
  #version = 0;

  constructor(options) {
    this.shader = {
      code: options.shader.code,
      vertex: options.shader.vertex,
      fragment: options.shader.fragment
    };
    build_bindings(this, options.bindings);    
  }
  
  get_id() { return this.#id; }
  get_version() { return this.#version; }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}