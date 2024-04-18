import { UNINITIALIZED } from "../constants.mjs";
import { Bindings } from "./bindings.mjs";

export class Material {
  #id = UNINITIALIZED;
  #version = 0;

  constructor(options) {
    this.shader = {
      code: options.shader.code,
      vertex: options.shader.vertex,
      fragment: options.shader.fragment
    };
    this.graphics = {
      cull: options.graphics?.cull || "back",
      primitive: options.graphics?.primitive || "triangle-list",
      depth: {
        test: options.graphics?.depth?.test || "greater",
        write: options.graphics?.depth?.write || true,
      }
    };
    this.attributes = options.attributes;
    this.bindings = new Bindings(options.bindings);
  }
  
  get_id() { return this.#id; }
  get_version() { return this.#version; }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}