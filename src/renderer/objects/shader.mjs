import { UNINITIALIZED } from "../constants.mjs";

export class Shader {
  #id = UNINITIALIZED;

  constructor(options) {
    this.code = options.code;
    this.vertex = options.vertex;
    this.fragment = options.fragment;
  }

  get_id() { return this.#id; }
  initialize(id) { if (this.#id == UNINITIALIZED) this.#id = id; }
}