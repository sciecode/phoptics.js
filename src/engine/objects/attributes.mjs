import { UNINITIALIZED } from "../constants.mjs";
import { Vertex, Instance } from "./geometry_bindings.mjs";

// TODO: handle attributes update
export class Attributes {
  #bid = UNINITIALIZED;
  #binding = 0;
  #layout = 0;
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

  add(binding) { // TODO: handle elements update
    if (binding instanceof Vertex) this.#vertices.push(binding);
    else if (binding instanceof Instance) this.#instances.push(binding);
  }

  initialize(bid, binding, layout, vert_offset, inst_offset, free) {
    if (this.#bid == UNINITIALIZED) {
      this.#bid = bid;
      this.#binding = binding;
      this.#layout = layout;
      this.#vertex_offset = vert_offset;
      this.#instance_offset = inst_offset;
      this.#free = free;
    }
  }
  get_bid() { return this.#bid; }
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
  }
}