import { UNINITIALIZED } from "../constants.mjs";

export class Attributes {
  #bid = UNINITIALIZED;
  #binding = 0;
  #layout = 0;
  #updated = false;
  #vertex_offset = 0;
  #instance_offset = 0;
  #free = () => {};

  #vertices = null;
  #instances = null;
  #elements = null;

  constructor(vertices = [], instances = []) {
    this.#vertices = vertices.slice();
    this.#instances = instances.slice();
    this.#elements = this.#vertices?.length && this.#vertices[0].count || 0;
  }

  get vertices() { return this.#vertices?.slice(); }
  get instances() { return this.#instances?.slice(); }
  get elements() { return this.#elements; }

  add_vertex(binding) {
    this.#updated = true;
    this.#vertices.push(binding);
    if (this.#vertices.length == 1) this.#elements = this.#vertices[0].count;
  }

  add_instance(binding) {
    this.#updated = true;
    this.#instances.push(binding);
  }

  remove_vertex(id) {
    this.#updated = true;
    this.#vertices.splice(id, 1);
  }

  remove_instance(id) {
    this.#updated = true;
    this.#instances.splice(id, 1);
  }

  initialize(bid, binding, layout, vert_offset, inst_offset, free) {
    if (this.#bid == UNINITIALIZED || this.#updated) {
      this.#bid = bid;
      this.#binding = binding;
      this.#layout = layout;
      this.#vertex_offset = vert_offset;
      this.#instance_offset = inst_offset;
      this.#free = free;
      this.#updated = false;
    }
  }
  get_bid() { return this.#bid; }
  has_update() { return this.#updated; }
  get_binding() { return this.#binding; }
  get_layout() { return this.#layout; }
  get_vertex_offset() { return this.#vertex_offset; }
  get_instance_offset() { return this.#instance_offset; }
  free_storage() {
    for (let vert of this.#vertices) vert.free_storage();
    for (let inst of this.#instances) inst.free_storage();
  }
  destroy() {
    this.#free(this.#bid);
    this.#bid = -1;
    this.#free = () => {};
  }
}