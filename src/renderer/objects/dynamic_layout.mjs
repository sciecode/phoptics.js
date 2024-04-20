import { UNINITIALIZED } from "../constants.mjs";

export class DynamicLayout {
  #id = UNINITIALIZED;
  #free = () => {}

  constructor(options) {
    this.info = options; 
  }
  
  get_id() { return this.#id; }
  initialize(id, free) { if (this.#id == UNINITIALIZED) { this.#id = id; this.#free = free } }
  destroy() { this.#free(this.#id); this.#id = -1; }
}