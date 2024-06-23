import { GPUResource } from "../../backend/constants.mjs";

const MAX_SIZE = 0x800_0000; // 128MB

export class DynamicManager {
  constructor(backend) {
    this.backend = backend;

    this.buffer = this.backend.resources.create_buffer({
      size: MAX_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.layout = backend.resources.create_group_layout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "read-only-storage" }
      }]
    });

    this.group = this.backend.resources.create_bind_group({
      layout: this.layout,
      entries: [{
        binding: 0,
        type: GPUResource.BUFFER,
        resource: this.buffer,
        offset: 0,
        size: MAX_SIZE,
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
    this.offset += mesh.dynamic.data.byteLength;

    return ret;
  }

  reset() { this.offset = 0; }
  commit() { this.backend.write_buffer(this.buffer, 0, this.data, 0, this.offset); }
}