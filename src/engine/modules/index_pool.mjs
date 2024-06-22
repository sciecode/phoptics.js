import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const BITS = 2;
const MAX_SIZE = 0x800_0000; // 128MB
const TOTAL_BLOCKS = 0x200_0000;
const MAX_ALLOCATIONS = 0x1_0000; // blocks of 512b
const STORAGE_MASK = (1 << BITS) - 1;

const aligned = (x) => (x + STORAGE_MASK) & ~STORAGE_MASK;

export class IndexPool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    this.backing = [];
    
    this.indices = new PoolStorage();
    this.index_callback = this.free_index.bind(this);
  }

  get_index(index_obj) {
    let id = index_obj.get_id();

    if (id == UNINITIALIZED) {
      const size = index_obj.size;
      const { heap, slot, offset, bid } = this.create(size);
      
      id = this.indices.allocate({
        heap: heap,
        slot: slot,
        bid: bid,
        offset: offset,
        index_offset: offset / index_obj.stride,
      });
      index_obj.initialize(id, bid, this.index_callback);
    }

    const cache = this.indices.get(id), update = index_obj.has_update();
    if (update) this.write(cache, update);

    return cache;
  }

  create(bytes) {
    let heap, slot, offset, bid;
    const aligned_bytes = aligned(bytes) >> BITS;
    for (let i = 0, il = this.allocators.length; i < il; i++) {
      const info = this.allocators[i].malloc(aligned_bytes);
      if (info.slot !== undefined) {
        heap = i;
        bid = this.buffers[heap];
        offset = info.offset << BITS;
        slot = info.slot;
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(TOTAL_BLOCKS, MAX_ALLOCATIONS));

      bid = this.backend.resources.create_buffer({
        size: MAX_SIZE,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);
      this.backing.push({ u8: new Uint8Array(MAX_SIZE), start: MAX_SIZE, end: 0 });

      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset << BITS;
      slot = info.slot;
    }

    return { heap, slot, offset, bid };
  }

  write(cache, update) {
    const data_buffer = ArrayBuffer.isView(update.data) ? update.data.buffer : update.data;
    const stride = ArrayBuffer.isView(update.data) ? update.data.BYTES_PER_ELEMENT : 1;
    const byte_size = update.size * stride;
    const offset = cache.offset + update.buffer_offset * stride;
    const src = new Uint8Array(data_buffer, update.data.byteOffset + update.data_offset * stride, byte_size);

    const backing = this.backing[cache.heap];
    backing.u8.set(src, offset);

    backing.start = Math.min(backing.start, offset);
    backing.end = Math.max(backing.end, offset + byte_size);
  }

  upload(staging) {
    for (let i = 0, il = this.backing.length; i < il; i++) {
      const backing = this.backing[i];
      if (backing.end) {
        staging.stage({
          bid: this.buffers[i],
          backing: backing.u8.subarray(backing.start, backing.end),
          offset: backing.start,
        });
        backing.start = MAX_SIZE, backing.end = 0;
      }
    }
  }

  free_index(index_id) {
    const cache = this.indices.get(index_id);
    this.allocators[cache.heap].free(cache.slot);
    this.indices.delete(index_id);
  }
}