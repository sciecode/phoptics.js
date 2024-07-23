import { Geometry, Vertex, Index } from 'phoptics';

import { TYPE } from './common/type.mjs';
import { Memory, memcpy } from "./common/memory.mjs";
import { compress_vertices, uncompress_vertices } from "./compression/vertex.mjs";
import { compress_indices, uncompress_indices } from './compression/index.mjs';

// == HEADER ==
// 0x00 - (4B) - format ID
// 0x04 - (1B) - vertex buffer count
// 0x05 - (4B) - vertex count
// 0x09 - (4B) - index count
// 0x0D - (4B) - index type (1b) / index compressed (31b)
// 0x11 - (1B) - size of user data buffer
//
// == VARIABLE HEADER ==
// 0x12 - (xB) - user data buffer
// ----------------------------------
// -- (1B) - stride                 |
// -- (1B) - type                   |
// -- (4B) - vertex compressed size | for each vertex buffer
// ----------------------------------
//
// == COMPRESSED DATA ==
// -- compressed index data
// -- compressed vertices data
//

const FORMAT_ID = 0xAA289;

const calculate_buffer_size = (geometry, indices, vertices, user_data) => {
  const V = geometry.attributes.vertices.length;
  const fixed_header = 18;
  const variable_header = (user_data?.byteLength || 0) + V * 6;
  const compressed_index_size = indices?.size || 0;

  let compressed_vertex_size = 0;
  for (let entry of vertices)
    compressed_vertex_size += entry.size;

  return fixed_header + variable_header + compressed_index_size + compressed_vertex_size;
};

const populate = (output, geometry, indices, vertices, user_data) => {
  let offset = 0;
  const dv = new DataView(output.buffer);
  const vertex_count = geometry.attributes.elements;

  // = FIXED HEADER =
  dv.setUint32(offset, FORMAT_ID); offset += 4;
  dv.setUint8(offset++, vertices.length);
  dv.setUint32(offset, vertex_count), offset += 4;
  dv.setUint32(offset, geometry.index?.count || 0); offset += 4;
  const index_type = geometry.index?.data.BYTES_PER_ELEMENT == 4 ? 1 : 0;
  dv.setUint32(offset, indices ? indices.size | index_type << 31 : 0); offset += 4;
  dv.setUint8(offset++, user_data?.byteLength || 0);

  // = VARIABLE HEADER =
  if (user_data) output.set(user_data, offset), offset += user_data.byteLength;

  // vertex info
  for (let i = 0; i < vertices.length; i++) {
    const entry = vertices[i];
    dv.setUint8(offset++, entry.stride);
    const type = geometry.attributes.vertices[i].data.constructor;
    dv.setUint8(offset++, TYPE.to_id(type));
    dv.setUint32(offset, entry.size), offset += 4;
  }

  // = COMPRESSED DATA =

  // compressed index buffer
  if (indices) {
    memcpy(output, offset, indices.buffer, 0, indices.size);
    offset += indices.size;
  }

  // compressed vertex buffers
  for (let entry of vertices) {
    memcpy(output, offset, entry.buffer, 0, entry.size);
    offset += entry.size;
  }
};

export const compress = (geometry, user_data) => {
  const indices = compress_indices(geometry);
  const vertices = compress_vertices(geometry);

  const size = calculate_buffer_size(geometry, indices, vertices, user_data);
  const output = new Uint8Array(size);
  populate(output, geometry, indices, vertices, user_data);

  return output;
};

const read_file_info = (compressed) => {
  let offset = 0;
  const dv = new DataView(compressed.buffer);

  // == FIXED HEADER =
  let format = dv.getUint32(offset); offset += 4;
  if (format != FORMAT_ID) throw "Phoptics::uncompress: Invalid file format.";

  let vertex_buffers_count = dv.getUint8(offset++);
  let vertex_count = dv.getUint32(offset); offset += 4;

  // index info
  const index_count = dv.getUint32(offset); offset += 4;
  const index_info = dv.getUint32(offset); offset += 4;
  const index_type = index_info & (1 << 31);
  const index_compressed_size = index_info & ~(1 << 31);
  const user_size = dv.getUint8(offset++);

  // == VARIABLE HEADER =
  let user_data;
  if (user_size) {
    user_data = compressed.slice(offset, offset + user_size);
    offset += user_size;
  }

  const info = {
    indices: {
      buffer: null,
      count: index_count,
      type: index_type ? TYPE.u32 : TYPE.u16,
    },
    vertex_count: vertex_count,
    vertices: new Array(vertex_buffers_count),
    user_data: user_data,
  };

  // vertex info
  for (let i = 0; i < vertex_buffers_count; ++i) {
    const vertex_size = dv.getUint8(offset++);
    const type = TYPE.from_id(dv.getUint8(offset++)).array;
    const compressed_size = dv.getUint32(offset); offset += 4;

    info.vertices[i] = {
      input: null,
      type: type,
      vertex_size: vertex_size,
      compressed_size: compressed_size,
      original_size: vertex_count * vertex_size,
    };
  }

  // == COMPRESSED DATA =

  // compressed index buffer
  if (index_compressed_size) {
    info.indices.buffer = new Uint8Array(compressed.buffer, offset, index_compressed_size);
    offset += index_compressed_size;
  }

  // compressed vertex buffers
  for (let i = 0; i < vertex_buffers_count; ++i) {
    const vertex = info.vertices[i];
    vertex.input = new Uint8Array(compressed.buffer, offset, vertex.compressed_size);
    offset += vertex.compressed_size;
  }

  return info;
};

export const uncompress = (buffer) => {
  if (buffer instanceof ArrayBuffer)
    buffer = new Uint8Array(buffer);

  const info = read_file_info(buffer);

  const buffers = info.vertices.map(entry => {
    return { type: TYPE.u8, count: entry.original_size };
  });

  if (info.indices.count) {
    buffers.push({
      type: info.indices.type,
      count: info.indices.count + (info.indices.type.bytes == 2 ? info.indices.count & 1 : 0),
    });
  }

  let indices;
  const mem = Memory.allocate_layout(buffers);
  if (info.indices.count)
    indices = uncompress_indices(mem[info.vertices.length], info.indices.buffer, info.indices.count);
  for (let i in info.vertices) {
    const vertex = info.vertices[i];
    vertex.output = mem[i];
    uncompress_vertices(mem[i], vertex.input, info.vertex_count, vertex.vertex_size);
  }

  const geometry = new Geometry({
    index: indices ? new Index({ data: indices, stride: indices.BYTES_PER_ELEMENT }) : undefined,
    vertices: info.vertices.map(vert => {
      const out = vert.output;
      const elements = out.byteLength / vert.type.BYTES_PER_ELEMENT;
      const data = new vert.type(out.buffer, out.byteOffset, elements);
      return new Vertex({ data: data, stride: vert.vertex_size });
    }),
  });

  return { geometry, user_data: info.user_data };
};