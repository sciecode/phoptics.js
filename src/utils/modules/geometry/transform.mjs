import { TYPE } from "./common/type.mjs";
import { Vertex } from 'phoptics';
import { Memory, memcpy } from './common/memory.mjs';

export const unweld = (geometry) => {
  const indices = geometry.index.data;
  const index_count = geometry.index.count;
  const buffer_count = geometry.attributes.vertices.length;

  const buffers = geometry.attributes.vertices.map(vertex => {
    return {
      stride: vertex.stride,
      input: new Uint8Array(vertex.data.buffer, vertex.data.byteOffset, vertex.size),
    };
  });

  let mem = [];
  for (let i = 0; i < buffer_count; ++i)
    mem.push({ type: TYPE.u8, count: index_count * buffers[i].stride });
  Memory.allocate_layout(mem);

  for (let k = 0; k < buffer_count; k++) {
    const out = mem[k], buffer = buffers[k], stride = buffer.stride;
    for (let i = 0; i < index_count; i++)
      memcpy(out, i * stride, buffer.input, indices[i] * stride, stride);

    const attrib = geometry.attributes.vertices[k];
    const type = attrib.data.constructor;
    const elements = out.byteLength / type.BYTES_PER_ELEMENT;
    geometry.attributes.vertices[k] = new Vertex({
      stride: attrib.stride,
      data: new type(out.buffer, out.byteOffset, elements),
    });
    if (k == 0) geometry.attributes.elements = geometry.attributes.vertices[k].count;
  }
  geometry.index = undefined;
};
