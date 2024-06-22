import { IndexPool } from "./index_pool.mjs";
import { VertexPool } from "./vertex_pool.mjs";
import { UniformPool } from "./uniform_pool.mjs";
import { BufferStaging } from "./buffer_staging.mjs";

export class BufferManager {
  constructor(backend) {
    this.staging = new BufferStaging(backend);
    this.uniforms = new UniformPool(backend);
    this.vertices = new VertexPool(backend);
    this.indices = new IndexPool(backend);
  }

  get_uniform(uniform_obj) { return this.uniforms.get(uniform_obj); }
  get_attribute(attrib_obj) { return this.vertices.get_attribute(attrib_obj); }
  get_index(index_obj) { return this.indices.get_index(index_obj); }
  dispatch() { 
    this.vertices.stage(this.staging);
    this.indices.stage(this.staging);
    this.uniforms.stage(this.staging);
    this.staging.upload(); 
  }
}