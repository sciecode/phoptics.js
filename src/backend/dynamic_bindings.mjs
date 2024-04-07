import { GPUResource } from "./constants.mjs";

const MASK = 255;
const BUFFER_SIZE = 1024 * 1024 * 128;
const calculate_size_aligned = (x) => (x + MASK) & ~MASK;

class BufferWriter {
  constructor(buffer) {
    this.buffer = buffer;
    this.f32 = new Float32Array(this.buffer);
    this.u32 = new Uint32Array(this.buffer);
    this.u8 = new Uint8Array(this.buffer);
  }

  f32_array(array, byte_offset) {
    this.f32.set(array, byte_offset >> 2);
  }
}

export class DynamicBindings {
  constructor(backend) {
    this.backend = backend;

    this.layouts_count = 1;
    this.layouts = new Array(128);
    this.groups = new Array(128);

    this.offset = 0;
    this.buffer = this.backend.resources.create_buffer({
      size: BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    this.writer = new BufferWriter(new ArrayBuffer(BUFFER_SIZE));
  }

  create_dynamic_binding(entries) {
    const info = {
      size: 0,
      bindings: new Array(entries.length),
      layout: null,
    };

    const desc = {
      entries: new Array(entries.length),
    };

    for (let i = 0, il = entries.length; i < il; i++) {
      const current_entry = entries[i];
      const aligned_size = calculate_size_aligned(current_entry.size);
      info.size += aligned_size;
      info.bindings[i] = { binding: current_entry.binding, size: aligned_size },
      desc.entries[i] = {
        binding: current_entry.binding,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          hasDynamicOffset: true,
          type: "read-only-storage",
        },
      }
    }

    info.layout = this.backend.resources.create_group_layout(desc);

    this.layouts[this.layouts_count] = info;
    return this.layouts_count++;
  }

  get_layout(id) {
    return this.layouts[id].layout;
  }

  allocate(id) {
    const entry = this.layouts[id];

    if (!this.groups[id]) {
      this.groups[id] = this.backend.resources.create_bind_group({
        layout: entry.layout,
        dynamic_entries: entry.bindings.length,
        entries: entry.bindings.map( (b) => {
          return {
            binding: b.binding,
            type: GPUResource.BUFFER,
            resource: this.buffer,
            size: b.size,
          };
        })
      });
    }

    const ret = {
      group: this.groups[id],
      offsets: []
    };

    for (let binding of entry.bindings) {
      ret.offsets.push(this.offset);
      this.offset += binding.size;
    }

    return ret;
  }

  reset() {
    this.offset = 0;
  }

  commit() {
    this.backend.write_buffer(this.buffer, 0, this.writer.buffer, 0, this.offset);
  }
}