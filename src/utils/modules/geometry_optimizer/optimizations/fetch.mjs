/**
 * = opt_fetch =
 * 
 * Reorders vertex buffers and updates indices to improve buffer locality & optimize fetch.
 * 
 * Based on Arseny Kapoulkine's meshoptimizer - https://github.com/zeux/meshoptimizer
 * Copyright notice in 'meshoptimizer-license.md'
 * 
**/

import { Memory, memcpy } from '../common/memory.mjs';

const EMPTY32 = 0xffff_ffff;

export const opt_fetch = (geometry) => {

  const indices = geometry.indices;
  const index_count = geometry.indices.length;
  const vertex_count = geometry.vertex_count;
  const buffer_count = geometry.buffers.length;

  const buffers = geometry.buffers.map(buf => {
    return { output: null, input: null, stride: null }
  });

  geometry.attributes.forEach(attrib => {
    const entry = buffers[attrib.buffer_id];
    if (!entry.stride) entry.stride = attrib.stride;
  });
  
  let mem = [];
  for (let i = 0; i < buffer_count; ++i)
    mem.push({ type: TYPE.u8, count: vertex_count * buffers[i].stride });
  Memory.allocate_layout(mem);

  for (let i = 0; i < buffer_count; ++i) {
    const entry = buffers[i];
    entry.input = geometry.buffers[i];
    geometry.buffers[i] = entry.output = mem[i];
  }
  
  let next_vertex = 0;
  const table = new Uint32Array(vertex_count).fill(EMPTY32);
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