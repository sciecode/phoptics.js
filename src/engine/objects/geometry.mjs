import { UNINITIALIZED } from "../constants.mjs";

export class Geometry {
  #id = UNINITIALIZED;
  #index_offset = 0;
  #vertex_offset = 0;
  #free = null;

  constructor(options) {
    this.draw = { 
      offset: options.draw?.offset || 0,
      count: options.draw?.count || 0
    };
    this.index = options.index;
    this.attributes = options.attributes || [];
  }

  initialize(id, index, vertex, free) { 
    if (this.#id == UNINITIALIZED) { 
      this.#id = id; 
      this.#index_offset = index;
      this.#vertex_offset = vertex;
      this.#free = free;
    }
  }
  get_id() { return this.#id; }
  get_index_offset() { return this.#index_offset + (this.index ? this.draw.offset : 0); }
  get_vertex_offset() { return this.#vertex_offset + (this.index ? 0 : this.draw.offset ); }
  destroy() {
    if (this.index) this.index.destroy();
    for (let i = 0, il = this.attributes.length; i < il; i++) this.attributes[i].destroy();
    this.#free(this.#id);
    this.#id = -1;
  }
}