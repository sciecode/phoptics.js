import { UNINITIALIZED } from "../constants.mjs";
import { Attributes } from "./attributes.mjs";

export class Geometry {
  #id = UNINITIALIZED;
  #index_offset = 0;

  constructor(options) {
    this.draw = {
      offset: options.draw?.offset || 0,
      count: options.draw?.count || 0,
      instance_count: options.draw?.instance_count || 1,
      instance_offset: options.draw?.instance_offset || 0,
    };
    this.index = options.index;
    this.attributes = new Attributes(options.vertices || [], options.instances || []);
  }

  initialize(id, index) {
    if (this.#id == UNINITIALIZED) {
      this.#id = id;
      this.#index_offset = index;
    }
  }
  get_id() { return this.#id; }
  get_index_offset() { return this.#index_offset + (this.index ? this.draw.offset : 0); }
  get_vertex_offset() { return this.attributes.get_vertex_offset() + (this.index ? 0 : this.draw.offset); }
  get_instance_offset() { return this.attributes.get_instance_offset() + this.draw.instance_offset; }
  get_attributes() { return this.attributes.get_binding(); }
  get_layout() { return this.attributes.get_layout(); }
  set_static() {
    if (this.index) this.index.free_storage();
    this.attributes.free_storage();
    return this;
  }
  destroy(destroy_buffers = false) {
    if (destroy_buffers) {
      if (this.index) this.index.destroy();
      this.attributes.destroy();
    }
  }
}