import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const BITS = 2;
const MAX_ALLOC = 0x7FFFF;
const BLOCK_SIZE = 128 * 1024 * 1024;
const STORAGE_MASK = (1 << BITS) - 1;

const aligned = (x) => (x + STORAGE_MASK) & ~STORAGE_MASK;

export class AttributePool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    this.attributes = new PoolStorage();

    this.free_callback = this.free.bind(this);
  }

  get(attrib_obj) {
    let id = attrib_obj.get_id();

    if (id == UNINITIALIZED) {
      const size = attrib_obj.total_bytes;
      const { heap, slot, offset, bid } = this.create(size);

      const attrib_bid = this.backend.resources.create_attribute({
        buffer: bid,
        byte_offset: offset,
        byte_size: size,
      });

      id = this.attributes.allocate({
        version: -1,
        heap: heap,
        slot: slot,
        bid: bid,
        attrib_bid: attrib_bid,
        offset: offset,
      });
      attrib_obj.initialize(id, attrib_bid, this.free_callback);
    }

    const cache = this.attributes.get(id), version = attrib_obj.get_version();
    if (cache.version != version) {
      cache.version = version;
      if (ArrayBuffer.isView(attrib_obj.data)) {
        this.backend.write_buffer(cache.bid, cache.offset, attrib_obj.data);
      } else {
        this.backend.write_buffer(cache.bid, cache.offset, attrib_obj.data, attrib_obj.offset, attrib_obj.total_bytes);
      }
    }

    return cache;
  }

  create(bytes) {
    let heap, slot, offset;
    const aligned_bytes = aligned(bytes) >> BITS;
    for (let i = 0, il = this.allocators.length; i < il; i++) {
      const info = this.allocators[i].malloc(aligned_bytes);
      if (info.slot !== undefined) {
        heap = i;
        offset = info.offset << BITS;
        slot = info.slot;
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(MAX_ALLOC));
      this.buffers.push(this.backend.resources.create_buffer({
          size: BLOCK_SIZE,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        })
      );
      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset << BITS;
      slot = info.slot;
    }

    const bid = this.buffers[heap];

    return { heap, slot, offset, bid };
  }

  free(attrib_id) {
    const cache = this.attributes.get(attrib_id);
    this.allocators[cache.heap].free(cache.slot);
    this.backend.resources.destroy_attribute(cache.attrib_bid);
    this.attributes.delete(attrib_id);
  }
}