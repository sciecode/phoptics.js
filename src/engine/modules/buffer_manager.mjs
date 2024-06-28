import { IndexPool } from "./index_pool.mjs";
// import { VertexPool } from "./vertex_pool.mjs";
import { VertexHeaps } from "./vertex_heaps.mjs";
import { UniformPool } from "./uniform_pool.mjs";

export class BufferManager {
  constructor(backend, manager) {
    this.uniforms = new UniformPool(backend);
    this.vertices = new VertexHeaps(backend, manager);
    this.indices = new IndexPool(backend);
  }

  get_uniform(uniform_obj) { return this.uniforms.get(uniform_obj); }
  get_attributes(attrib_obj) { return this.vertices.get_attributes(attrib_obj); }
  get_index(index_obj) { return this.indices.get_index(index_obj); }
  dispatch() {
    this.vertices.dispatch();
    this.indices.dispatch();
    this.uniforms.dispatch();
  }
}