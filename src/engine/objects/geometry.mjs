import { Attributes } from "./attributes.mjs";

export class Geometry {
  #index = undefined;
  #attributes = undefined;

  constructor(options) {
    this.draw = {
      offset: options.draw?.offset || 0,
      count: options.draw?.count || options.index?.count || options.attributes.elements || 0,
      instance_count: options.draw?.instance_count || 1,
      instance_offset: options.draw?.instance_offset || 0,
    };
    this.#index = options.index;
    this.#attributes = new Attributes(options.vertices || [], options.instances || []);
  }

  get index() { return this.#index; }
  set index(ind) {
    this.#index?.destroy();
    this.#index = ind;
  }

  get attributes() { return this.#attributes; }
  set attributes(attribs) {
    this.#attributes?.destroy();
    this.#attributes = attribs;
  }

  get_index_offset() { return this.#index ? this.#index.get_index_offset() + this.draw.offset : -1; }
  get_vertex_offset() { return this.#attributes.get_vertex_offset() + (this.#index ? 0 : this.draw.offset); }
  get_instance_offset() { return this.#attributes.get_instance_offset() + this.draw.instance_offset; }
  get_attributes() { return this.#attributes.get_binding(); }
  get_layout() { return this.#attributes.get_layout(); }
  set_static() {
    this.#index?.free_storage();
    this.#attributes?.free_storage();
    return this;
  }
  destroy() {
    this.#index?.destroy();
    this.#attributes?.destroy();
  }
}