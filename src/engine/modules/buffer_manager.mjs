import { UniformPool } from "./uniform_pool.mjs";
import { AttributePool } from "./attribute_pool.mjs";
import { InterleavedPool } from "./interleaved_pool.mjs";
import { IndexdPool } from "./index_pool.mjs";

export class BufferManager {
  constructor(backend) {
    this.uniforms = new UniformPool(backend);
    this.attributes = new AttributePool(backend);
    this.interleaved = new InterleavedPool(backend);
    this.indices = new IndexdPool(backend);
  }

  get_uniform(uniform_obj) {
    return this.uniforms.get(uniform_obj);
  }

  get_attribute(attrib_obj) {
    return this.attributes.get(attrib_obj);
  }

  get_interleaved(inter_obj) {
    return this.interleaved.get(inter_obj);
  }

  get_index(index_obj) {
    return this.indices.get(index_obj);
  }
}