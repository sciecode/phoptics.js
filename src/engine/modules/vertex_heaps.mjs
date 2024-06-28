import { UNINITIALIZED } from "../constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";
import { SparseSet } from "../../common/sparse_set.mjs";

let HEAP_SIZE = 0x2000000; // 32MB
let align_storage = (bytes) => (bytes + 255) & 255;

export class VertexHeaps {
  constructor(backend, cache) {
    this.backend = backend;
    this.cache = cache;

    this.slots = new PoolStorage(); // hid, slot, offset, binding_id
    this.heaps = new PoolStorage(); // buffer, allocator, backing
    this.formats = new SparseSet(); // heaps, offsets
    this.bindings = new SparseSet(); // groups, layouts

    this.free = this.free_attributes.bind(this);
  }

  get_attributes(attributes) {
    let bid = attributes.get_bid();

    if (bid == UNINITIALIZED) {
      const { vertices, instances } = this.format_hash(attributes);

      let binding_cache, binding_hash = 0;
      let info = { vertices: null, instances: null, binding: null };

      if (vertices.hash) {
        info.vertices = this.find_cache(vertices);
        binding_hash |= info.vertices.hid;
      }

      if (instances.hash) {
        info.instances = this.find_cache(vertices);
        binding_hash |= info.vertices.hid << 16;
      }

      info.binding = this.bindings.has(binding_hash);

      if (info.binding === undefined) {

        const layout_entries = [], group_entries = [];
        if (vertices.hash) this.create_binding_descriptor(layout_entries, group_entries, info.vertices);
        if (instances.hash) this.create_binding_descriptor(layout_entries, group_entries, info.instances);

        const layout_cache = this.cache.material_manager.create_layout({
          entries: layout_entries
        });

        const layout = layout_cache.id;
        const binding = this.backend.resources.create_bind_group({
          layout: layout_cache.layout,
          entries: group_entries,
        });

        binding_cache = { binding, layout, count: 1, hash: binding_hash };
        info.binding = this.bindings.set(binding_hash, binding_cache);
      } else {
        binding_cache = this.bindings.get(info.binding);
        binding_cache.count++;
      }

      bid = this.slots.allocate(info);
      attributes.initialize(bid, 
        binding_cache.binding, binding_cache.layout, 
        info.vertices?.offset || 0, info.instances?.offset || 0,
        this.free
      );
    }

    // check for updates
    // for each heap update backing, store range
  }

  find_cache(block) {
    const attrib0 = block.entries[0];
    const count = attrib0.size / attrib0.stride;
    const format_info = this.get_format(block.hash);
    return this.get_heap(format_info, count);
  }

  get_heap(format_info, count) {
    for (let heap_id of format_info.format.heaps) {
      const allocation = this.heaps.get(heap_id).allocator.malloc(count);
      if (allocation) return { hid, slot: allocation.slot, offset: allocation.offset };
    }

    const bid = this.backend.resources.create_buffer({
      size: HEAP_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const allocator = new OffsetAllocator(format_info.format.elements);
    const backing = { u8: new Uint8Array(MAX_SIZE), ranges: [], min: -1, max: -1 };
    
    let hid = this.heaps.allocate({ 
      bid, backing, allocator, 
      offsets: format_info.format.offsets,
      fid: format_info.fid,
    });
    let { slot, offset } = allocator.malloc(count);
    return { hid, slot, offset };
  }

  get_format(heap_info) {
    let hash = heap_info.hash;
    let fid = this.formats.has(hash);
    if (fid != undefined) return { fid, format: this.formats.get(cid) };

    let offset = 0;
    let offsets = [], heaps = [];
    let elements = ((HEAP_SIZE - 255 * (heap_info.entries.length - 1)) / heap_info.size) | 0;
    for (let attrib of heap_info.entries)
      offsets.push(offset), offset = align_storage(offset + elements * attrib.stride);

    let format = { hash, offsets, heaps, elements };
    fid = this.formats.set(hash, format);

    return { fid, format };
  }

  create_binding_descriptor(layout, group, info) {
    let heap = this.heaps.get(info.hid);
    let bid = heap.bid, offsets = heap.offsets;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const size = ((i + 1) == offsets.length ? MAX_SIZE : offsets[i + 1]) - offset;
      layout.push({
        binding: layout.length,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" }
      });
      group.push({
        binding: group.length,
        type: GPUResource.BUFFER,
        resource: bid,
        offset: offset,
        size: size,
      });
    }
  }

  free_attributes(bid) {
    const slot = this.slots.get(bid);
    this.slots.delete(bid);

    const binding_cache = this.bindings.get(slot.binding);
    if (!--binding_cache.count) {
      this.backend.resources.destroy_bind_group(binding_cache.binding);
      this.cache.material_manager.free_layout(binding_cache.layout);
      this.bindings.delete(slot.binding, binding_cache.hash);
    }

    if (slot.vertices) this.free_allocation(slot.vertices);
    if (slot.instances) this.free_allocation(slot.instances);
  }

  free_allocation(info) {
    const hid = info.hid, heap = this.heaps.get(hid);
    heap.allocator.free(info.slot);

    const format = this.formats.get(heap.fid);
    if (heap.allocator.free_storage == format.elements) {
      this.backend.resources.destroy_buffer(heap.buffer);
      heap.allocator = heap.backing = null;
      this.heaps.delete(hip);

      format.heaps.splice(format.heaps.findIndex(hip), 1);
      if (!format.heaps.length) 
        this.formats.delete(heap.fid, format.hash);
    }
  }

  format_hash(attributes) {
    let vertices = { entries: attributes.vertices, hash: 0, size: 0, format: null };
    let instances = { entries: attributes.instances, hash: 0, size: 0, format: null };
    
    let vert_id = 0, inst_id = 0;
    for (let vert of attributes.vertices) {
      vertices.size += vert.stride;
      vertices.hash |= vert.stride << (vert_id++ << 3);
    }
    for (let inst of attributes.instances) {
      instances.size += inst.stride;
      instances.hash |= inst.stride << (inst_id++ << 3);
    }

    return { vertices, instances };
  }
}