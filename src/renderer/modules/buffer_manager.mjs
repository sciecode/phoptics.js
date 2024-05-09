import { UniformPool } from "./uniform_pool.mjs";
import { AttributePool } from "./attribute_pool.mjs";
import { InterleavedPool } from "./interleaved_pool.mjs";

export class BufferManager {
  constructor(backend) {
    this.backend = backend;
    this.uniforms = new UniformPool(backend);
    this.attributes = new AttributePool(backend);
    this.interleaved = new InterleavedPool(backend);
  }

  update(bid, offset, data) {
    this.backend.write_buffer(bid, offset, data);
  }

  create_uniform(bytes) {
    return this.uniforms.create(this.backend, bytes);
  }

  delete_uniform(heap, slot) {
    this.uniforms.delete(heap, slot);
  }

  create_attribute(bytes) {
    return this.attributes.create(this.backend, bytes);
  }

  delete_attribute(heap, slot) {
    this.attributes.delete(heap, slot);
  }

  create_interleaved(bytes, stride) {
    return this.interleaved.create(this.backend, bytes, stride);
  }

  delete_interleaved(heap, slot) {
    this.interleaved.delete(heap, slot);
  }
}