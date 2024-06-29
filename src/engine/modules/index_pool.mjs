import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { SparseArray } from "../../common/sparse_array.mjs";

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

    this.indices = new SparseArray();
    this.index_callback = this.free_index.bind(this);
  }

  get_index(index_obj) {
    let id = index_obj.get_id();

    if (id == UNINITIALIZED) {
      const size = index_obj.size;
      const { heap, slot, offset, bid } = this.create(size);

      const index_cache = {
        heap: heap,
        slot: slot,
        bid: bid,
        offset: offset,
        index_offset: offset / index_obj.stride,
      };

      const sid = index_obj.stride >> 2;
      const index_offset = index_cache.index_offset | (sid << 31);
      id = this.indices.allocate(index_cache);

      index_obj.initialize(id, bid, index_offset, this.index_callback);
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
      this.backing.push({ u8: new Uint8Array(MAX_SIZE), ranges: [], min: -1, max: -1 });

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

    this.insert_range(backing, { st: offset, end: offset + byte_size });
  }

  insert_range(backing, range) {
    if (backing.min < 0) {
      backing.min = backing.max = 0;
    } else {
      let idx = backing.ranges.length;
      if (range.st < backing.ranges[backing.min].st) backing.min = idx;
      if (range.end > backing.ranges[backing.max].end) backing.max = idx;
    }
    backing.ranges.push(range);
  }

  coalesce(backing) {
    let tmp = backing.ranges[0];
    backing.ranges[0] = backing.ranges[backing.min];
    backing.ranges[backing.min] = tmp;
    if (backing.min == backing.max) {
      backing.ranges.length = 1;
    } else {
      tmp = backing.ranges[1];
      backing.ranges[1] = backing.ranges[backing.max];
      backing.ranges[backing.max] = tmp;

      // coalesce internals
      let min = backing.ranges[0], max = backing.ranges[1];
      for (let i = 2, il = backing.ranges.length; i < il; i++) {
        const cur = backing.ranges[i];
        const a = cur.st - min.end, b = max.st - cur.end;
        if (a < b) min.end = Math.max(min.end, cur.end);
        else max.st = Math.min(max.st, cur.st);
      }

      // coalesce ends
      const sum = min.end - min.st + max.end - max.st;
      if (max.st - min.end < sum * .25) {
        min.end = max.end;
        backing.ranges.length = 1;
      } else {
        backing.ranges.length = 2;
      }
    }
    backing.min = backing.max = -1;
    return;
  }

  dispatch() {
    for (let i = 0, il = this.backing.length; i < il; i++) {
      const backing = this.backing[i];
      if (backing.ranges.length) {
        this.coalesce(backing);
        for (let range of backing.ranges)
          this.backend.write_buffer(this.buffers[i], range.st, backing.u8, range.st, range.end - range.st);
        backing.ranges.length = 0;
      }
    }
  }

  free_index(index_id) {
    const cache = this.indices.get(index_id);
    this.allocators[cache.heap].free(cache.slot);
    this.indices.delete(index_id);
  }
}