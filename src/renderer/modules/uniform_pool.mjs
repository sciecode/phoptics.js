import { OffsetAllocator } from "../../common/offset_allocator.mjs";

const BITS = 8;
const MAX_ALLOC = 0x7FFFF;
const STORAGE_MASK = (1 << BITS) - 1;
const BLOCK_SIZE = 128 * 1024 * 1024;

const aligned = (x) => (x + STORAGE_MASK) & ~STORAGE_MASK;

export class UniformPool {
  constructor() {
    this.allocators = [];
    this.buffers = [];
  }

  create(backend, bytes) {
    let heap, slot, offset;
    const aligned_bytes = aligned(bytes) >> BITS;
    for (let i = this.allocators.length - 1; i >= 0; i--) {
      const info = this.allocators[heap].malloc(aligned_bytes);
      if (info.slot !== undefined) {
        heap = i;
        offset = info.offset;
        slot = info.slot;
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(MAX_ALLOC));
      this.buffers.push(backend.resources.create_buffer({
          size: BLOCK_SIZE,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        })
      );
      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset;
      slot = info.slot;
    }

    const bid = this.buffers[heap];

    return { heap, slot, offset, bid };
  }

  delete(heap, slot) {
    this.allocators[heap].free(slot);
  }
}