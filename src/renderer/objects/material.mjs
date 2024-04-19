import { UNINITIALIZED } from "../constants.mjs";
import { Bindings } from "./bindings.mjs";

export class Material {
  #id = UNINITIALIZED;
  #version = 0;

  constructor(options) {
    this.shader = options.shader; 
    this.graphics = {
      cull: options.graphics?.cull || "back",
      primitive: options.graphics?.primitive || "triangle-list",
      depth: {
        test: options.graphics?.depth?.test || "greater",
        write: options.graphics?.depth?.write || true,
      }
    };
    this.vertex = options.vertex;
    this.bindings = options.bindings ? new Bindings(options.bindings) : undefined;
  }
  
  get_id() { return this.#id; }
  get_version() { return this.#version; }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
  update() { this.#version = (this.#version + 1) & UNINITIALIZED; }
}