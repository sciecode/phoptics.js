import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const MAX_ALLOC = 0x7FFFF;
const BLOCK_SIZE = 128 * 1024 * 1024;

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
    let id = inter_obj.get_id();

    if (id == UNINITIALIZED) {
      const { heap, slot, offset, bid, attrib_bid } = this.create(inter_obj.total_bytes, inter_obj.stride);
     
      id = this.interleaved.allocate({
        version: -1,
        heap: heap,
        slot: slot,
        bid: bid,
        attrib_bid: attrib_bid,
        offset: offset,
        vertex_offset: offset / inter_obj.stride
      });
      inter_obj.initialize(id, attrib_bid, this.free_callback);
    }

    const cache = this.interleaved.get(id), version = inter_obj.get_version();
    if (cache.version != version) {
      cache.version = version;
      if (ArrayBuffer.isView(inter_obj.data)) {
        this.backend.write_buffer(cache.bid, cache.offset, inter_obj.data);
      } else {
        this.backend.write_buffer(cache.bid, cache.offset, inter_obj.data, inter_obj.offset, inter_obj.total_bytes);
      }
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
      this.allocators.push(new OffsetAllocator(MAX_ALLOC));

      bid = this.backend.resources.create_buffer({
        size: BLOCK_SIZE,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);

      attrib_bid = this.backend.resources.create_attribute({
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

  free(inter_id) {
    const cache = this.interleaved.get(inter_id);
    this.allocators[cache.heap].free(cache.slot);
    this.interleaved.delete(inter_id);
  }
}