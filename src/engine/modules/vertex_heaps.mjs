import { UNINITIALIZED } from "../constants.mjs";
import { GPUResource } from "../../backend/constants.mjs";
import { OffsetAllocator } from "../../common/offset_allocator.mjs";
import { PoolStorage } from "../../common/pool_storage.mjs";
import { SparseSet } from "../../common/sparse_set.mjs";

let HEAP_SIZE = 0x2000000; // 32MB
let align_storage = (bytes) => (bytes + 255) & 255;

export class VertexHeaps {
  constructor(backend, manager) {
    this.backend = backend;
    this.manager = manager;

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

      let binding_cache, binding_hash = -1;
      let info = { vertices: null, instances: null, binding: null };

      if (vertices.hash) {
        info.vertices = this.find_cache(vertices);
        binding_hash = info.vertices.hid;
      }

      if (instances.hash) {
        info.instances = this.find_cache(instances);
        if (binding_hash == -1) binding_hash = 0;
        binding_hash |= info.instances.hid << 16;
      }

      info.binding = this.bindings.has(binding_hash);

      if (info.binding === undefined) {
        const layout_entries = [], group_entries = [];
        if (vertices.hash) this.create_binding_descriptor(layout_entries, group_entries, info.vertices);
        if (instances.hash) this.create_binding_descriptor(layout_entries, group_entries, info.instances);

        const layout_cache = this.manager.create_layout({
          entries: layout_entries
        });

        const layout = layout_cache.id;
        const binding = this.backend.resources.create_bind_group({
          layout: layout_cache.layout,
          entries: group_entries,
        });

        binding_cache = { binding, layout, count: 1 };
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

    let heap, offset, update, slot;
    for (let i = 0, il = attributes.vertices.length; i < il; i++) {
      const vertex = attributes.vertices[i];
      if (update = vertex.has_update()) {
        if (heap === undefined) {
          if (slot === undefined) slot = this.slots.get(bid);
          const allocation = slot.vertices;
          heap = this.heaps.get(allocation.hid);
          offset = allocation.offset;
        }
        this.update_backing(heap, offset, update, vertex.stride, i);
      }
    }

    heap = undefined;
    for (let i = 0, il = attributes.instances.length; i < il; i++) {
      const instance = attributes.instances[i];
      if (update = instance.has_update()) {
        if (heap === undefined) {
          if (slot === undefined) slot = this.slots.get(bid);
          const allocation = slot.instances;
          heap = this.heaps.get(allocation.hid);
          offset = allocation.offset;
        }
        this.update_backing(heap, offset, update, instance.stride, i);
      }
    }
  }

  update_backing(heap, offset, update, stride, idx) {
    const data_buffer = ArrayBuffer.isView(update.data) ? update.data.buffer : update.data;
    const data_stride = ArrayBuffer.isView(update.data) ? update.data.BYTES_PER_ELEMENT : 1;
    const byte_size = update.size * data_stride;
    const buffer_offset = heap.offsets[idx] + offset * stride + update.buffer_offset * data_stride;
    const src = new Uint8Array(data_buffer, update.data.byteOffset + update.data_offset * data_stride, byte_size);

    const backing = heap.backing;
    backing.u8.set(src, buffer_offset);
    let range = backing.ranges[idx];
    range.min = Math.min(range.min, buffer_offset);
    range.max = Math.max(range.max, buffer_offset + byte_size);
  }

  dispatch() {
    let count = this.heaps.size(), i = 0;
    while (count) {
      let heap = this.heaps.get(i++);
      if (heap) {
        const backing = heap.backing;
        for (let range of backing.ranges) {
          if (range.max >= 0) {
            this.backend.write_buffer(heap.bid, range.min, backing.u8, range.min, range.max - range.min);
            range.min = Infinity;
            range.max = -Infinity;
          }
        }
        count--;
      }
    }
  }

  find_cache(block) {
    const attrib0 = block.entries[0];
    const count = attrib0.size / attrib0.stride;
    const format_info = this.get_format(block);
    return this.get_heap(format_info, count);
  }

  get_heap(format_info, count) {
    for (let hid of format_info.format.heaps) {
      const allocation = this.heaps.get(hid).allocator.malloc(count);
      if (allocation) return { hid, slot: allocation.slot, offset: allocation.offset };
    }

    const bid = this.backend.resources.create_buffer({
      size: HEAP_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const allocator = new OffsetAllocator(format_info.format.elements);
    const ranges = format_info.format.offsets.map(_ => { return { min: Infinity, max: -Infinity }; });
    const backing = { u8: new Uint8Array(HEAP_SIZE), ranges: ranges };

    let hid = this.heaps.allocate({
      bid, backing, allocator,
      offsets: format_info.format.offsets,
      fid: format_info.fid,
    });

    format_info.format.heaps.push(hid);
    let { slot, offset } = allocator.malloc(count);
    return { hid, slot, offset };
  }

  get_format(heap_info) {
    let hash = heap_info.hash;
    let fid = this.formats.has(hash);
    if (fid != undefined) return { fid, format: this.formats.get(fid) };

    let offset = 0;
    let offsets = [], heaps = [];
    let elements = ((HEAP_SIZE - 255 * (heap_info.entries.length - 1)) / heap_info.size) | 0;
    for (let attrib of heap_info.entries)
      offsets.push(offset), offset = align_storage(offset + elements * attrib.stride);

    let format = { offsets, heaps, elements };
    fid = this.formats.set(hash, format);

    return { fid, format };
  }

  create_binding_descriptor(layout, group, info) {
    let heap = this.heaps.get(info.hid);
    let bid = heap.bid, offsets = heap.offsets;
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const size = ((i + 1) == offsets.length ? HEAP_SIZE : offsets[i + 1]) - offset;
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
      this.manager.free_layout(binding_cache.layout);
      this.bindings.delete(slot.binding);
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
        this.formats.delete(heap.fid);
    }
  }

  format_hash(attributes) {
    let vertices = { entries: attributes.vertices, hash: 0, size: 0 };
    let instances = { entries: attributes.instances, hash: 0, size: 0 };

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