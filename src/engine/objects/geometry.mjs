import { UNINITIALIZED } from "../constants.mjs";

export class Geometry {
  #id = UNINITIALIZED;
  #index_offset = 0;
  #layout = 0;
  #vertices_bid = 0;
  #free = null;

  constructor(options) {
    this.draw = { 
      offset: options.draw?.offset || 0,
      count: options.draw?.count || 0,
      instance_count: options.draw?.instance_count || 1,
      instance_offset: options.draw?.instance_offset || 0,
    };
    this.index = options.index;
    this.attributes = options.attributes || [];
  }

  initialize(id, index, vertex, layout, free) { 
    if (this.#id == UNINITIALIZED) { 
      this.#id = id; 
      this.#index_offset = index;
      this.#vertices_bid = vertex;
      this.#layout = layout;
      this.#free = free;
    }
  }
  get_id() { return this.#id; }
  get_index_offset() { return this.#index_offset + (this.index ? this.draw.offset : 0); }
  get_vertex_offset() { return this.index ? 0 : this.draw.offset; }
  get_vertices() { return this.#vertices_bid; }
  get_layout() { return this.#layout; }
  set_static() { 
    if (this.index) this.index.free_storage();
    for (let i = 0, il = this.attributes.length; i < il; i++) this.attributes[i].free_storage();
    return this;
  }
  destroy(destroy_buffers = false) {
    if (destroy_buffers) {
      if (this.index) this.index.destroy();
      for (let i = 0, il = this.attributes.length; i < il; i++) this.attributes[i].destroy();
    }
    this.#free(this.#id);
    this.#id = -1;
  }
}