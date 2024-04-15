import { OffsetAllocator } from "../common/offset_allocator.mjs";
import { ResourceData } from "./resources/resource_data.mjs";

const BITS = 8;
const STORAGE_MASK = 255;
const MAX_ALLOC = 512 * 1024;
const BLOCK_SIZE = 128 * 1024 * 1024;

const calculate_size_aligned = (x) => (x + STORAGE_MASK) & ~STORAGE_MASK;

export class BufferManager {
  constructor(backend) {
    this.backend = backend;
    this.array_buffer = new ArrayBuffer(BLOCK_SIZE);
    this.allocator = new OffsetAllocator(MAX_ALLOC);
    this.buffer = backend.resources.create_buffer({
      size: BLOCK_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
  }

  create_resource_data(desc) {
    let total_bytes = 0;

    const entries = new Array(desc.length);
    for (let entry of desc) total_bytes += entry.type.byte_size;

    const block_bytes = calculate_size_aligned(total_bytes);
    const { offset, id } = this.allocator.malloc(block_bytes >> BITS);
    let current_offset = offset << BITS;

    const info = { offset: current_offset, size: total_bytes };

    for (let i = 0, il = desc.length; i < il; i++) {
      const entry = desc[i];
      entries[i] = { name: entry.name, view: new entry.type(this.array_buffer, current_offset) };
      current_offset += entry.type.byte_size;
    }

    return new ResourceData(id, info, entries);
  }

  update_resource_data(data) {
    const { offset, size } = data.get_info();
    this.backend.write_buffer(this.buffer, offset, this.array_buffer, offset, size);
  }

  dispose_resource_data(data) {
    this.allocator.free(data.id);
  }
}