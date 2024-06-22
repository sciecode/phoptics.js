import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const BITS = 8;
const MAX_SIZE = 0x800_0000; // 128MB
const TOTAL_BLOCKS = 0x8_0000;
const STORAGE_MASK = (1 << BITS) - 1;

const aligned = (x) => (x + STORAGE_MASK) & ~STORAGE_MASK;

export class VertexPool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    
    this.attributes = new PoolStorage();
    this.attribute_callback = this.free_attribute.bind(this);
  }

  get_attribute(attrib_obj) {
    let id = attrib_obj.buffer.get_id();

    if (id == UNINITIALIZED) {
      const size = attrib_obj.buffer.size;
      const { heap, slot, offset, bid, buffer_size } = this.create(size);

      id = this.attributes.allocate({
        heap: heap,
        slot: slot,
        bid: bid,
        size: buffer_size,
        offset: offset,
      });
      attrib_obj.buffer.initialize(id, bid, this.attribute_callback);
    }

    const cache = this.attributes.get(id), update = attrib_obj.has_update();
    if (update) {
      this.backend.write_buffer(
        cache.bid, cache.offset + update.buffer_offset,
        update.data, update.data_offset, update.size
      );
    }

    return cache;
  }

  create(bytes) {
    let heap, slot, offset, bid, buffer_size = aligned(bytes);
    const aligned_bytes = buffer_size >> BITS;
    for (let i = 0, il = this.allocators.length; i < il; i++) {
      const info = this.allocators[i].malloc(aligned_bytes);
      if (info.slot !== undefined) {
        heap = i;
        bid = this.buffers[heap];
        offset = info.offset << BITS
        slot = info.slot;
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(TOTAL_BLOCKS));

      bid = this.backend.resources.create_buffer({
        size: MAX_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);

      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset << BITS;
      slot = info.slot;
    }

    return { heap, slot, offset, bid, buffer_size };
  }

  free_attribute(attrib_id) {
    const cache = this.attributes.get(attrib_id);
    this.allocators[cache.heap].free(cache.slot);
    this.attributes.delete(attrib_id);
  }
}