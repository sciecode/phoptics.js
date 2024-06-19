import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const MAX_SIZE = 0x8000000; // 128MB
const MAX_ALLOCATIONS = 0x8000;

export class InterleavedPool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    this.attributes = [];
    this.interleaved = new PoolStorage();

    this.free_callback = this.free.bind(this);
  }

  get(inter_obj) {
    let id = inter_obj.buffer.get_id();

    if (id == UNINITIALIZED) {
      const { heap, slot, offset, bid, attrib_bid } = this.create(inter_obj.buffer.size, inter_obj.stride);
     
      id = this.interleaved.allocate({
        heap: heap,
        slot: slot,
        bid: bid,
        attrib_bid: attrib_bid,
        offset: offset,
        vertex_offset: offset / inter_obj.stride
      });
      inter_obj.buffer.initialize(id, attrib_bid, this.free_callback);
    }

    const cache = this.interleaved.get(id), update = inter_obj.has_update();
    if (update) {
      this.backend.write_buffer(
        cache.bid, cache.offset + inter_obj.offset,
        update.data, update.offset, update.size
      );
    }

    return cache;
  }

  create(bytes, stride = 4) {
    let heap, slot, offset, attrib_bid, bid;
    const aligned_bytes = bytes + stride;
    for (let i = 0, il = this.allocators.length; i < il; i++) {
      const info = this.allocators[i].malloc(aligned_bytes);
      if (info.slot !== undefined) {
        heap = i;
        bid = this.buffers[heap];
        attrib_bid = this.attributes[heap];
        slot = info.slot;
        const aligned_offset = Math.ceil(info.offset / stride) * stride;
        offset = aligned_offset;
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(MAX_SIZE, MAX_ALLOCATIONS));

      bid = this.backend.resources.create_buffer({
        size: MAX_SIZE,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);

      attrib_bid = this.backend.resources.create_attribute({
        buffer: bid,
        byte_offset: 0,
        byte_size: MAX_SIZE
      });

      this.attributes.push(attrib_bid);

      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset;
      slot = info.slot;
    }

    return { heap, slot, offset, bid, attrib_bid };
  }

  free(inter_id) {
    const cache = this.interleaved.get(inter_id);
    this.allocators[cache.heap].free(cache.slot);
    this.interleaved.delete(inter_id);
  }
}