import { UniformPool } from "./uniform_pool.mjs";

export class BufferManager {
  constructor(backend) {
    this.backend = backend;
    this.uniforms = new UniformPool(backend);
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
}