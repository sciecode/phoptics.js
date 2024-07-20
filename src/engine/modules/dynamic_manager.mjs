import { GPUResource } from "../../backend/constants.mjs";

const MAX_SIZE = 0x800_0000; // 128MB

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

    this.layout_id = layout_cache.id;
    this.layout = layout_cache.layout;

    this.groups = [];

    this.offset = 0;
    this.data = new Uint8Array(MAX_SIZE);
  }

  allocate(mesh) {
    const dyn = mesh.dynamic, group_info = this.get_group_info(dyn.blocks);
    const ret = {
      group: group_info.group,
      offset: this.offset,
    };

    this.data.set(dyn.data, this.offset);
    dyn.set_cache(group_info.group, this.offset);

    this.offset += group_info.bytes;
    return ret;
  }

  get_group_info(blocks) {
    if (!this.groups[blocks]) {
      const bytes = blocks << 8;
      this.groups[blocks] = {
        bytes,
        group: this.backend.resources.create_bind_group({
          layout: this.layout,
          dynamic_entries: 1,
          entries: [{
            binding: 0,
            type: GPUResource.BUFFER,
            resource: this.buffer,
            size: bytes
          }]
        }),
      };
    }

    return this.groups[blocks];
  }

  commit() {
    if (this.offset)
      this.backend.write_buffer(this.buffer, 0, this.data, 0, this.offset);
    this.offset = 0;
  }
}