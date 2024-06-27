import { ResourceType, UNINITIALIZED } from "../constants.mjs";
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
  }

  get_attributes(attributes) {
    let bid = attributes.get_bid();

    if (bid == UNINITIALIZED) {
      const { vertices, instanced } = this.format_hash(attributes);

      let binding_hash = 0;
      let info = { vertices: null, instanced: null, binding: null };
      let format_offset = { vertices: null, instanced: null };

      if (vertices.hash) {
        const format_info = this.find_format(vertices.hash);
        format_offset.vertices = format_info.format.offsets;

        const attrib0 = vertices.entries[0];
        const count = attrib0.size / attrib0.stride;
        info.vertices = this.find_heap(format_info, count);
        binding_hash |= info.vertices.hid;
      }

      if (instanced.hash) {
        const format_info = this.find_format(instanced.hash);
        format_offset.instanced = format_info.format.offsets;

        const attrib0 = instanced.entries[0];
        const count = attrib0.size / attrib0.stride;
        info.instanced = this.find_heap(format_info, count);
        binding_hash |= info.instanced.hid << 16;
      }

      let binding_cache;
      info.binding = this.bindings.has(binding_hash);

      if (info.binding === undefined) {
        const layout_cache = this.cache.material_manager.create_layout({
          entries: attributes.entries.map( (e, i) => {
            return {
              binding: i,
              visibility: GPUShaderStage.VERTEX,
              buffer: { type: "read-only-storage" }
            }
          })
        });

        const binding_desc = {
          layout: layout_cache.layout,
          entries: [],
        };

        if (vertices.hash) {
          let offsets = info.vertices.format.offsets;
          let bid = this.heaps.get(info.vertices.hid).bid;
          for (let i = 0; i < offsets.length; i++) {
            const offset = offsets[i];
            const size = ((i + 1) == offsets.length ? MAX_SIZE : offsets[i + 1]) - offset;
            binding_desc.entries.push({
              binding: binding_desc.entries.length,
              type: GPUResource.BUFFER,
              resource: bid,
              offset: offset,
              size: size,
            });
          }
        }

        if (instanced.hash) {
          let offsets = info.instanced.format.offsets;
          let bid = this.heaps.get(info.instanced.hid).bid;
          for (let i = 0; i < offsets.length; i++) {
            const offset = offsets[i];
            const size = ((i + 1) == offsets.length ? MAX_SIZE : offsets[i + 1]) - offset;
            binding_desc.entries.push({
              binding: binding_desc.entries.length,
              type: GPUResource.BUFFER,
              resource: bid,
              offset: offset,
              size: size,
            });
          }
        }

        const layout = layout_cache.id;
        const binding = this.backend.resources.create_bind_group(binding_desc);

        binding_cache = { binding, layout, count: 1, hash: binding_hash };
        info.binding = this.bindings.set(binding_hash, binding_cache);
      } else {
        binding_cache = this.bindings.get(info.binding);
        binding_cache.count++;
      }

      bid = this.slots.allocate(info);
      attributes.initialize(bid, 
        binding_cache.binding, binding_cache.layout, 
        info.vertices?.offset || 0, info.instanced?.offset || 0
      ); // TODO: impl free logic
    }

      // check for updates
      // for each heap update backing, store range
  }

  find_heap(format_info, count) {
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
    
    let hid = this.heaps.allocate({ bid, backing, allocator, fid: format_info.fid });
    let { slot, offset } = allocator.malloc(count);
    return { hid, slot, offset };
  }

  find_format(heap_info) {
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

  format_hash(attributes) {
    let vert_id = 0, inst_id = 0;
    let vertices = { entries: [], hash: 0, size: 0, format: null };
    let instanced = { entries: [], hash: 0, size: 0, format: null };
    for (let attrib of attributes.entries) {
      if (attrib.type == ResourceType.Vertex) {
        vertices.size += attrib.stride;
        vertices.hash |= attrib.stride << (vert_id++ << 3);
        vertices.entries.push(attrib);
      } else {
        instanced.size += attrib.stride;
        instanced.hash |= attrib.stride << (inst_id++ << 3);
        instanced.entries.push(attrib);
      }
    }

    return { vertices, instanced };
  }
}