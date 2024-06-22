import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const MAX_SIZE = 0x8000000; // 128MB
const MAX_ALLOCATIONS = 0x8000; // blocks of 4KB

const round_up = (n, k) => Math.ceil(n / k) * k;
const gcd = (a, b) => (a) ? gcd(b % a, a) : b;
const lcm4 = (a) => (a & 3) ? (a * 4) / gcd(a, 4) : a;

export class IndexPool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    this.indices = new PoolStorage();

    this.index_callback = this.free_index.bind(this);
  }

  get_index(index_obj) {
    let id = index_obj.buffer.get_id();

    if (id == UNINITIALIZED) {
      const { heap, slot, offset, bid } = this.create(index_obj.buffer.size, index_obj.stride);
      
      id = this.indices.allocate({
        heap: heap,
        slot: slot,
        bid: bid,
        offset: offset,
        index_offset: offset / index_obj.stride,
      });
      index_obj.buffer.initialize(id, bid, this.index_callback);
    }

    const cache = this.indices.get(id), update = index_obj.has_update();
    if (update) {
      this.backend.write_buffer(
        cache.bid, cache.offset + update.buffer_offset,
        update.data, update.data_offset, update.size
      );
    }

    return cache;
  }

  create(bytes, stride) {
    let heap, slot, offset, bid;
    const lcm = lcm4(stride);
    for (let i = 0, il = this.allocators.length; i < il; i++) {
      const info = this.allocators[i].malloc(bytes + lcm);
      if (info.slot !== undefined) {
        heap = i;
        bid = this.buffers[heap];
        slot = info.slot;
        offset = round_up(info.offset, lcm);
        break;
      }
    }

    if (heap == undefined) {
      heap = this.allocators.length;
      this.allocators.push(new OffsetAllocator(MAX_SIZE, MAX_ALLOCATIONS));

      bid = this.backend.resources.create_buffer({
        size: MAX_SIZE,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);

      const info = this.allocators[heap].malloc(bytes + lcm);
      offset = round_up(info.offset, lcm);
      slot = info.slot;
    }

    return { heap, slot, offset, bid };
  }

  free_index(index_id) {
    const cache = this.indices.get(index_id);
    this.allocators[cache.heap].free(cache.slot);
    this.indices.delete(index_id);
  }
}