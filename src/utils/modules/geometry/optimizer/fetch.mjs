/**
 * = opt_fetch =
 * 
 * Reorders vertex buffers and updates indices to improve buffer locality & optimize fetch.
 * 
 * Based on Arseny Kapoulkine's meshoptimizer - https://github.com/zeux/meshoptimizer
 * Copyright notice in 'meshoptimizer-license.md'
 * 
**/

import { TYPE } from "../common/type.mjs";
import { Memory, memcpy } from '../common/memory.mjs';

const EMPTY32 = 0xffff_ffff;

export const opt_fetch = (geometry) => {
  const indices = geometry.index.data;
  const index_count = (indices.length / 3 | 0) * 3;
  const attrib = geometry.attributes[0];
  const vertex_count = attrib.total_bytes / attrib.stride;
  const buffer_count = geometry.attributes.length;

  const buffers = geometry.attributes.map(vertex => {
    return { output: null, input: vertex.data, stride: vertex.stride }
  });
  
  let mem = [];
  for (let i = 0; i < buffer_count; ++i)
    mem.push({ type: TYPE.u8, count: vertex_count * buffers[i].stride });
  mem.push({ type: TYPE.u32, count: vertex_count});
  Memory.allocate_layout(mem);

  for (let i = 0; i < buffer_count; ++i)
    geometry.attributes[i].data = buffers[i].output = mem[i];
  
  let next_vertex = 0;
  const table = mem[buffer_count].fill(EMPTY32);
  for (let i = 0; i < index_count; ++i) {
    const index = indices[i];
    if (table[index] == EMPTY32) table[index] = next_vertex++;
    indices[i] = table[index];
  }

  for (let j = 0; j < buffer_count; ++j) {
    const entry = buffers[j], stride = entry.stride;
    for (let i = 0, il = table.length; i < il; ++i)
      memcpy(entry.output, table[i] * stride, entry.input, i * stride, stride);
  }
} 