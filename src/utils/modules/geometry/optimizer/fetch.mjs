/**
 * = opt_fetch =
 * 
 * Reorders vertex buffers and updates indices to improve buffer locality & optimize fetch.
 * 
 * Based on Arseny Kapoulkine's meshoptimizer - https://github.com/zeux/meshoptimizer
 * Copyright notice in 'meshoptimizer-license.md'
 * 
**/

import { Vertex, Attributes } from 'phoptics';
import { TYPE } from "../common/type.mjs";
import { Memory, memcpy } from '../common/memory.mjs';

const EMPTY32 = 0xffff_ffff;

export const opt_fetch = (geometry) => {
  const indices = geometry.index.data;
  const index_count = geometry.index.count;
  const vertex_count = geometry.attributes.elements;
  const buffer_count = geometry.attributes.vertices.length;

  const buffers = geometry.attributes.vertices.map(vertex => {
    return {
      output: null,
      input: new Uint8Array(vertex.data.buffer, vertex.data.byteOffset, vertex.size),
      stride: vertex.stride
    };
  });

  let mem = [];
  for (let i = 0; i < buffer_count; ++i)
    mem.push({ type: TYPE.u8, count: vertex_count * buffers[i].stride });
  mem.push({ type: TYPE.u32, count: vertex_count });
  Memory.allocate_layout(mem);

  for (let i = 0; i < buffer_count; ++i)
    buffers[i].output = mem[i];

  let next_vertex = 0;
  const table = mem[buffer_count].fill(EMPTY32);
  for (let i = 0; i < index_count; ++i) {
    const index = indices[i];
    if (table[index] == EMPTY32) table[index] = next_vertex++;
    indices[i] = table[index];
  }

  const vertices = new Array(buffer_count);
  for (let j = 0; j < buffer_count; ++j) {
    const entry = buffers[j], stride = entry.stride;
    for (let i = 0, il = table.length; i < il; ++i)
      memcpy(entry.output, table[i] * stride, entry.input, i * stride, stride);
    const attrib = geometry.attributes.vertices[j];
    const type = attrib.data.constructor;
    const elements = entry.output.byteLength / type.BYTES_PER_ELEMENT;
    vertices[j] = new Vertex({
      stride: attrib.stride,
      data: new type(entry.output.buffer, entry.output.byteOffset, elements),
    });
  }
  geometry.attributes = new Attributes(vertices);
}; 