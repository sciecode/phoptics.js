import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";

const MAX_SIZE = 0x8000000; // 128MB
const MAX_ALLOCATIONS = 0x8000; // blocks of 4KB

// requires number of bytes in input array to be a multiple of 4

const round_up = (n, k) => Math.ceil(n / k) * k;

const gcd = (a, b) => (a) ? gcd(b % a, a) : b;
const lcm4 = (a) => (a & 3) ? (a * 4) / gcd(a, 4) : a;

export class VertexPool {
  constructor(backend) {
    this.backend = backend;

    this.allocators = [];
    this.buffers = [];
    this.generics = [];
    this.indices = new PoolStorage();
    this.attributes = new PoolStorage();
    this.interleaved = new PoolStorage();

    this.index_callback = this.free_index.bind(this);
    this.attribute_callback = this.free_attribute.bind(this);
    this.interleaved_callback = this.free_interleaved.bind(this);
  }

  get_attribute(attrib_obj) {
    let id = attrib_obj.buffer.get_id();

    if (id == UNINITIALIZED) {
      const size = attrib_obj.buffer.size;
      const { heap, slot, offset, bid } = this.create(size, attrib_obj.stride);

      const attrib_bid = this.backend.resources.create_attribute({
        buffer: bid,
        byte_offset: offset,
        byte_size: size,
      });

      id = this.attributes.allocate({
        heap: heap,
        slot: slot,
        bid: bid,
        attrib_bid: attrib_bid,
        offset: offset,
      });
      attrib_obj.buffer.initialize(id, attrib_bid, this.attribute_callback);
    }

    const cache = this.attributes.get(id), update = attrib_obj.has_update();
    if (update) {
      this.backend.write_buffer(
        cache.bid, cache.offset + attrib_obj.offset,
        update.data, update.offset, update.size
      );
    }

    return cache;
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
        cache.bid, cache.offset + index_obj.offset, 
        update.data, update.offset, update.size
      );
    }

    return cache;
  }

  get_interleaved(inter_obj) {
    let id = inter_obj.buffer.get_id();

    if (id == UNINITIALIZED) {
      const { heap, slot, offset, bid } = this.create(inter_obj.buffer.size, inter_obj.stride);

      const attrib_bid = this.generics[heap];
     
      id = this.interleaved.allocate({
        heap: heap,
        slot: slot,
        bid: bid,
        attrib_bid: attrib_bid,
        offset: offset,
        vertex_offset: offset / inter_obj.stride
      });
      inter_obj.buffer.initialize(id, attrib_bid, this.interleaved_callback);
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
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });

      this.buffers.push(bid);

      const generics_bid = this.backend.resources.create_attribute({
        buffer: bid,
        byte_offset: 0,
        byte_size: MAX_SIZE
      });

      this.generics.push(generics_bid);

      const info = this.allocators[heap].malloc(bytes + lcm);
      offset = round_up(info.offset, lcm);
      slot = info.slot;
    }

    return { heap, slot, offset, bid };
  }

  free_attribute(attrib_id) {
    const cache = this.attributes.get(attrib_id);
    this.allocators[cache.heap].free(cache.slot);
    this.backend.resources.destroy_attribute(cache.attrib_bid);
    this.attributes.delete(attrib_id);
  }

  free_index(index_id) {
    const cache = this.indices.get(index_id);
    this.allocators[cache.heap].free(cache.slot);
    this.indices.delete(index_id);
  }

  free_interleaved(inter_id) {
    const cache = this.interleaved.get(inter_id);
    this.allocators[cache.heap].free(cache.slot);
    this.interleaved.delete(inter_id);
  }
}