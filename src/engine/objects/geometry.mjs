import { UNINITIALIZED } from "../constants.mjs";

export class Geometry {
  #id = UNINITIALIZED;
  #index_offset = 0;
  #vertex_offset = 0;

  constructor(options) {
    this.count = options.count || 0;
    this.index = options.index;
    this.attributes = options.attributes || [];
  }

  initialize(id, index, vertex) { 
    if (this.#id == UNINITIALIZED) { 
      this.#id = id; 
      this.#index_offset = index;
      this.#vertex_offset = vertex;
    }
  }
  get_id() { return this.#id; }
  get_index_offset() { return this.#index_offset; }
  get_vertex_offset() { return this.#vertex_offset; }
}