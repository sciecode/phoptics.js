
import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const MAX_ALLOC = 0x7FFFF;
const BLOCK_SIZE = 128 * 1024 * 1024;

export class IndexdPool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    this.indices = new PoolStorage();

    this.index_callback = this.free.bind(this);
  }

  get(index_obj) {
    let id = index_obj.get_id();

    if (id == UNINITIALIZED) {
      const { heap, slot, offset, bid } = this.create(index_obj.total_bytes, index_obj.stride);
      
      id = this.indices.allocate({
        version: -1,
        heap: heap,
        slot: slot,
        bid: bid,
        offset: offset,
        index_offset: offset / index_obj.stride,
      });
      index_obj.initialize(id, bid, this.index_callback);
    }

    const cache = this.indices.get(id), version = index_obj.get_version();
    if (cache.version != version) {
      cache.version = version;
      if (ArrayBuffer.isView(index_obj.data)) {
        this.backend.write_buffer(cache.bid, cache.offset, index_obj.data);
      } else {
        this.backend.write_buffer(cache.bid, cache.offset, index_obj.data, index_obj.offset, index_obj.total_bytes);
      }
    }

    return cache;
  }

  create(bytes, stride = 4) {
    let heap, slot, offset, bid;
    const aligned_bytes = bytes + stride;
    for (let i = 0, il = this.allocators.length; i < il; i++) {
      const info = this.allocators[i].malloc(aligned_bytes);
      if (info.slot !== undefined) {
        heap = i;
        bid = this.buffers[heap];
        slot = info.slot;
        offset = Math.ceil(info.offset / stride) * stride;
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(MAX_ALLOC));

      bid = this.backend.resources.create_buffer({
        size: BLOCK_SIZE,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);

      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset;
      slot = info.slot;
    }

    return { heap, slot, offset, bid };
  }

  free(index_id) {
    const cache = this.indices.get(index_id);
    this.allocators[cache.heap].free(cache.slot);
    this.indices.delete(index_id);
  }
}