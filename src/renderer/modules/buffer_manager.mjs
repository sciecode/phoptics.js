import { UniformPool } from "./uniform_pool.mjs";

export class BufferManager {
  constructor(backend) {
    this.backend = backend;
    this.uniforms = new UniformPool(backend);
  }

  create_uniform(bytes) {
    return this.uniforms.create(this.backend, bytes);
  }

  update_uniform(bid, offset, data) {
    this.backend.write_buffer(bid, offset, data);
  }

  delete_uniform(heap, slot) {
    this.uniforms.delete(heap, slot);
  }
}