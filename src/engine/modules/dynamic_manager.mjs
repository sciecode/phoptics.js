import { GPUResource } from "../../backend/constants.mjs";

const MAX_SIZE = 0x800_0000; // 128MB
const aligned = (x) => (x + 255) & ~255;

export class DynamicManager {
  constructor(backend, cache) {
    this.backend = backend;

    this.buffer = this.backend.resources.create_buffer({
      size: MAX_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const layout_cache = cache.material_manager.create_layout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { hasDynamicOffset: true, type: "read-only-storage" }
      }]
    });

    this.layout = layout_cache.id;

    this.group = this.backend.resources.create_bind_group({
      layout: layout_cache.layout,
      dynamic_entries: 1,
      entries: [{
        binding: 0,
        type: GPUResource.BUFFER,
        resource: this.buffer,
        size: 1024, // TODO: temporary fix with unique groups
      }]
    });

    this.offset = 0;
    this.data = new Uint8Array(MAX_SIZE);
  }

  allocate(mesh) {
    const ret = {
      group: this.group,
      offset: this.offset,
    };

    this.data.set(mesh.dynamic.data, this.offset);
    this.offset += aligned(mesh.dynamic.data.byteLength);

    return ret;
  }

  reset() { this.offset = 0; }
  commit() {
    if (this.offset)
      this.backend.write_buffer(this.buffer, 0, this.data, 0, this.offset);
  }
}