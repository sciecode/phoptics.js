import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const BITS = 8;
const MAX_SIZE = 0x800_0000; // 128MB
const TOTAL_BLOCKS = 0x8_0000;
const STORAGE_MASK = (1 << BITS) - 1;

const aligned = (x) => (x + STORAGE_MASK) & ~STORAGE_MASK;

export class UniformPool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    this.backing = [];
    this.uniforms = new PoolStorage();

    this.free_callback = this.free.bind(this);
  }

  get(uniform_obj) {
    let id = uniform_obj.get_id();

    if (id == UNINITIALIZED) {
      const { heap, slot, offset, bid } = this.create(uniform_obj.total_bytes);
      id = this.uniforms.allocate({
        version: -1,
        heap: heap,
        slot: slot,
        bid: bid,
        offset: offset,
        size: uniform_obj.total_bytes,
      });
      uniform_obj.initialize(id, this.free_callback);
    }

    const cache = this.uniforms.get(id), version = uniform_obj.get_version();
    if (cache.version != version) {
      cache.version = version;
      this.write(cache, uniform_obj.bytes);
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
      this.allocators.push(new OffsetAllocator(TOTAL_BLOCKS));

      this.buffers.push(this.backend.resources.create_buffer({
          size: MAX_SIZE,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        })
      );
      this.backing.push({ u8: new Uint8Array(MAX_SIZE), ranges: [], min: -1, max: -1 });

      const info = this.allocators[heap].malloc(aligned_bytes);
      offset = info.offset << BITS;
      slot = info.slot;
    }

    const bid = this.buffers[heap];

    return { heap, slot, offset, bid };
  }

  write(cache, bytes) {
    const byte_size = bytes.byteLength, offset = cache.offset;

    const backing = this.backing[cache.heap];
    backing.u8.set(bytes, offset);

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

  free(uniform_id) {
    const cache = this.uniforms.get(uniform_id);
    this.allocators[cache.heap].free(cache.slot);
    this.uniforms.delete(uniform_id);
  }
}