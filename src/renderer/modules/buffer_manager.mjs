import { OffsetAllocator } from "../../common/offset_allocator.mjs";

const BITS = 8;
const MAX_ALLOC = 0x7FFFF;
const STORAGE_MASK = (1 << BITS) - 1;
const BLOCK_SIZE = 128 * 1024 * 1024;

const aligned = (x) => (x + STORAGE_MASK) & ~STORAGE_MASK;

export class BufferManager {
  constructor(backend) {
    this.backend = backend;
    this.allocator = new OffsetAllocator(MAX_ALLOC);
    this.buffer = backend.resources.create_buffer({
      size: BLOCK_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
  }

  create(bytes) {
    const { offset, id } = this.allocator.malloc(aligned(bytes) >> BITS);
    return {
      slot_id: id,
      offset: offset << BITS,
      bid: this.buffer,
    };
  }

  update(bid, offset, data) {
    this.backend.write_buffer(bid, offset, data);
  }

  dispose(slot_id) {
    this.allocator.free(slot_id);
  }
}