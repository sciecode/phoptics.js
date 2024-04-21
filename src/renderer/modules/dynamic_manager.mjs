import { GPUResource } from "../../backend/constants.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";
import { UNINITIALIZED } from "../constants.mjs";

const MASK = 255;
const BUFFER_SIZE = 1024 * 1024 * 128;
const aligned = (x) => (x + MASK) & ~MASK;

export class DynamicManager {
  constructor(backend) {
    this.backend = backend;

    this.groups = new PoolStorage();
    this.layout = backend.resources.create_group_layout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { hasDynamicOffset: true, type: "read-only-storage" }
      }]
    });

    this.offset = 0;
    this.buffer = this.backend.resources.create_buffer({
      size: BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.data = new Uint8Array(BUFFER_SIZE);

    this.group_callback = this.free_group.bind(this);
  }

  get_id(layout_obj) {
    let id = layout_obj.get_id();

    if (id == UNINITIALIZED) {
      const size = aligned(parse_layout(layout_obj.info));
      const group = this.backend.resources.create_bind_group({
        layout: this.layout,
        dynamic_entries: 1,
        entries: [{
          binding: 0,
          type: GPUResource.BUFFER,
          resource: this.buffer,
          size: size,
        }]
      })

      id = this.groups.allocate({ size: size, group: group });
      layout_obj.initialize(id, this.group_callback);
    }

    return id;
  }

  free_group(id) {
    const cache = this.groups.get(id);
    this.backend.resources.destroy_bind_group(cache.group);
    this.groups.delete(id);
  }

  allocate(id) {
    const cache = this.groups.get(id);
  
    const ret = {
      group: cache.group,
      offset: this.offset,
    };

    this.offset += cache.size;

    return ret;
  }

  reset() {
    this.offset = 0;
  }

  commit() {
    this.backend.write_buffer(this.buffer, 0, this.data, 0, this.offset);
  }
}

const parse_layout = (info) => {
  let total_bytes = 0;
  for (let entry of info) {
    if (typeof entry.type == 'function') {
      if (!entry.count || entry.count < 2) {
        total_bytes += entry.type.byte_size;
      } else {
        for (let i = 0; i < entry.count; i++) total_bytes += entry.type.byte_size;
      }
    } else {
      if (!entry.count || entry.count < 2) {
        total_bytes += parse_layout(entry.type);
      } else {
        for (let i = 0; i < entry.count; i++) total_bytes += parse_layot(entry.type);
      }
    }
  }

  return total_bytes;
}