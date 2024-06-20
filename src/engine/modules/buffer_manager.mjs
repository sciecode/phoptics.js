import { UniformPool } from "./uniform_pool.mjs";
import { VertexPool } from "./vertex_pool.mjs";

export class BufferManager {
  constructor(backend) {
    this.uniforms = new UniformPool(backend);
    this.vertices = new VertexPool(backend);
  }

  get_uniform(uniform_obj) {
    return this.uniforms.get(uniform_obj);
  }

  get_attribute(attrib_obj) {
    return this.vertices.get_attribute(attrib_obj);
  }

  get_interleaved(inter_obj) {
    return this.vertices.get_interleaved(inter_obj);
  }

  get_index(index_obj) {
    return this.vertices.get_index(index_obj);
  }
}