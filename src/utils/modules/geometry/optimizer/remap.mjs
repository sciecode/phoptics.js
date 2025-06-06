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

import { Index, Vertex, Attributes } from 'phoptics';
import { TYPE } from "../common/type.mjs";
import { Hash32 } from "../common/hash.mjs";
import { Memory, memcpy } from '../common/memory.mjs';

const EMPTY32 = 0xffff_ffff;

const calculate_bucket_count = (count) => 1 << Math.ceil(Math.log2(count * 1.25));

class Remapper {
  constructor(geometry) {
    let get_index, index_count, next_vertex = 0;
    const index = geometry.index;
    const vertex_count = geometry.attributes.elements;
    const bucket_count = calculate_bucket_count(vertex_count);

    if (index) {
      index_count = index.count;
      get_index = i => index.data[i];
    } else {
      index_count = vertex_count;
      get_index = i => i;
    }

    const mem = {
      table: { type: TYPE.u32, count: vertex_count },
      buckets: { type: TYPE.u32, count: bucket_count },
    };

    Memory.allocate_layout(mem);
    this.table = mem.table.fill(EMPTY32);
    this.buckets = mem.buckets.fill(EMPTY32);

    this.buffers = geometry.attributes.vertices.map(vertex => {
      let data = (vertex.data instanceof Uint8Array) ?
        vertex.data : new Uint8Array(vertex.data.buffer, vertex.data.byteOffset, vertex.size);
      return { buffer: data, stride: vertex.stride };
    });

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
    const indices = (this.vertex_count < 65536) ?
      new Uint16Array(this.index_count + (this.index_count & 1)) : new Uint32Array(this.index_count);

    for (let i = 0, il = this.index_count; i < il; ++i)
      indices[i] = this.table[get_index(i)];

    geometry.index = new Index({
      data: indices,
      stride: indices.BYTES_PER_ELEMENT
    });
    geometry.draw.offset = 0;
    geometry.draw.count = geometry.index.count;
  }

  remap_vertices(geometry) {
    const mem = [];
    for (let k = 0; k < this.buffers.length; ++k)
      mem.push({ type: TYPE.u8, count: this.vertex_count * this.buffers[k].stride });

    Memory.allocate_layout(mem);
    const vertices = new Array(this.buffers.length);
    for (let k = 0; k < this.buffers.length; ++k) {
      const new_buffer = mem[k];
      const { buffer, stride } = this.buffers[k];

      for (let i = 0, il = this.table.length; i < il; ++i) {
        if (this.table[i] == EMPTY32) continue;
        memcpy(new_buffer, this.table[i] * stride, buffer, i * stride, stride);
      }
      const attrib = geometry.attributes.vertices[k];
      const type = attrib.data.constructor;
      const elements = new_buffer.byteLength / type.BYTES_PER_ELEMENT;
      vertices[k] = new Vertex({
        stride: attrib.stride,
        data: new type(new_buffer.buffer, new_buffer.byteOffset, elements),
      });
    }
    geometry.attributes = new Attributes(vertices);
  }
}

export const opt_remap = (geometry) => {
  const remapper = new Remapper(geometry);
  remapper.remap_indices(geometry);
  remapper.remap_vertices(geometry);
};