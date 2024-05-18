/**
 * = opt_remap =
 * 
 * Prepares geometry for posterior optimizations.
 * Duplicated and unused vertices will be removed, outputs indexed-geometry.
 * 
 * Based on Arseny Kapoulkine's meshoptimizer - https://github.com/zeux/meshoptimizer
 * Copyright notice in 'meshoptimizer-license.md'
 * 
**/

import { Buffer } from 'phoptics';
import { TYPE } from "../common/type.mjs";
import { Hash32 } from "../common/hash.mjs";
import { Memory, memcpy } from '../common/memory.mjs';

const EMPTY32 = 0xffff_ffff;

const calculate_bucket_count = (count) => 1 << Math.ceil(Math.log2(count * 1.25));

class Remapper {
  constructor(geometry) {
    let get_index, index_count, next_vertex = 0;
    const attrib = geometry.attributes[0];
    const index = geometry.index;
    const vertex_count = attrib.total_bytes / attrib.stride;
    const bucket_count = calculate_bucket_count(vertex_count);

    if (index) {
      if (!ArrayBuffer.isView(index.data)) {
        const constructor = index.stride == 4 ? Uint32Array : Uint16Array;
        index.data = new constructor(index.data, index.offset, index.total_bytes / index.stride);
      }
      index_count = index.data.length;
      get_index = i => index.data[i];
    } else {
      index_count = vertex_count;
      get_index = i => i
    }

    const mem = {
      table:    { type: TYPE.u32, count: vertex_count },
      buckets:  { type: TYPE.u32, count: bucket_count },
    }

    Memory.allocate_layout(mem);
    this.table = mem.table.fill(EMPTY32);
    this.buckets = mem.buckets.fill(EMPTY32);
    
    this.buffers = geometry.attributes.map(vertex => {
      let data;
      if (ArrayBuffer.isView(vertex.data)) {
        data = (vertex.data instanceof Uint8Array) ? 
        vertex.data : new Uint8Array(vertex.data.buffer, vertex.data.byteOffset, vertex.data.byteLength);
      } else {
        data = new Uint8Array(vertex.data, vertex.offset, vertex.total_bytes);
      }
      return { buffer: data, stride: vertex.stride }
    })

    this.mask = bucket_count - 1;

    for (let i = 0; i < index_count; ++i) {
      const index = get_index(i);
      const entry = this.lookup(index);
      this.table[index] = (entry == EMPTY32) ? next_vertex++ : this.table[entry];
    }

    this.vertex_count = next_vertex;
    this.index_count = index_count;
  }

  lookup(key) {
    const h = this.hash(key);
    let bucket = h & this.mask;

    for (let p = 0; p <= this.mask; ++p) {
      const item = this.buckets[bucket];
      if (item == EMPTY32) {
        this.buckets[bucket] = key;
        return EMPTY32;
      } else if (this.equal(item, key)) {
        return item;
      }
      bucket = (bucket + p + 1) & this.mask;
    }

    throw "Phoptics::remap: Lookup - shouldn\'t reach";
  }

  hash(key) {
    let hash = undefined;
    for (let entry of this.buffers)
      hash = Hash32(hash, entry.buffer, key * entry.stride, entry.stride);
    return hash;
  }

  equal(a, b) {
    for (let entry of this.buffers) {
      let o = 0;
      const lhs = a * entry.stride, rhs = b * entry.stride;
      while (o < entry.stride)
        if (entry.buffer[lhs + o] != entry.buffer[rhs + o++])
          return false;
    }
    return true;
  }

  remap_indices(geometry) {
    const has_index = !!geometry.index;
    const get_index = has_index ? i => geometry.index.data[i] : i => i;
    const indices = new Uint32Array(this.index_count); // TODO: update when uint16 index is enabled

    for (let i = 0, il = this.index_count; i < il; ++i)
      indices[i] = this.table[get_index(i)];

    geometry.index = new Buffer({
      data: indices,
      total_bytes: indices.byteLength,
      stride: indices.BYTES_PER_ELEMENT
    });
    geometry.draw.offset = 0;
    geometry.draw.count = indices.length;
  }

  remap_vertices(geometry) {
    const mem = [];
    for (let k = 0; k < this.buffers.length; ++k)
      mem.push({ type: TYPE.u8, count: this.vertex_count * this.buffers[k].stride });

    Memory.allocate_layout(mem);
    for (let k = 0; k < this.buffers.length; ++k) {
      const new_buffer = mem[k];
      const { buffer, stride } = this.buffers[k];

      for (let i = 0, il = this.table.length; i < il; ++i) {
        if (this.table[i] == EMPTY32) continue;
        memcpy(new_buffer, this.table[i] * stride, buffer, i * stride, stride);
      }
      const attrib = geometry.attributes[k];
      attrib.data = new_buffer;
      attrib.total_bytes = new_buffer.byteLength;
      attrib.offset = 0;
    }
  }
}

export const opt_remap = (geometry) => {
  const remapper = new Remapper(geometry);
  remapper.remap_indices(geometry);
  remapper.remap_vertices(geometry);
}