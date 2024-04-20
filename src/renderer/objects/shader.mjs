import { UNINITIALIZED } from "../constants.mjs";

export class Shader {
  #id = UNINITIALIZED;
  #free = () => {}

  constructor(options) {
    this.code = options.code;
    this.vertex = options.vertex || "vs";
    this.fragment = options.fragment || "fs";
  }

  get_id() { return this.#id; }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free } }
  destroy() {
    this.#free(this.#id);
    this.#id = -1;
  }

}