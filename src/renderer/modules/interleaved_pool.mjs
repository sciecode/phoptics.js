import { OffsetAllocator } from "../../common/offset_allocator.mjs";

const MAX_ALLOC = 0x7FFFF;
const BLOCK_SIZE = 128 * 1024 * 1024;

export class InterleavedPool {
  constructor() {
    this.allocators = [];
    this.buffers = [];
    this.attributes = [];
  }

  create(backend, bytes, stride = 4) {
    let heap, slot, offset, attrib_bid, bid;
    const aligned_bytes = bytes + stride;
    for (let i = 0, il = this.allocators.length; i < il; i++) {
      const info = this.allocators[i].malloc(aligned_bytes);
      if (info.slot !== undefined) {
        heap = i;
        bid = this.buffers[heap];
        attrib_bid = this.attributes[heap];
        slot = info.slot;
        const aligned_offset = Math.ceil( info.offset / stride ) * stride;
        offset = aligned_offset;
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(MAX_ALLOC));

      bid = backend.resources.create_buffer({
        size: BLOCK_SIZE,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);

      attrib_bid = backend.resources.create_attribute({
        buffer: bid,
        byte_offset: 0,
        byte_size: BLOCK_SIZE,
      });

      this.attributes.push(attrib_bid);

      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset;
      slot = info.slot;
    }

    return { heap, slot, offset, bid, attrib_bid };
  }

  delete(heap, slot) {
    this.allocators[heap].free(slot);
  }
}