import { Geometry, BufferData } from 'phoptics';

import { TYPE } from './common/type.mjs';
import { Memory, memcpy } from "./common/memory.mjs";
import { compress_vertices, uncompress_vertices } from "./compression/vertex.mjs";
import { compress_indices, uncompress_indices } from './compression/index.mjs';

// == HEADER ==
// 0x00 - (4B) - format ID
// 0x01 - (1B) - vertex buffer count
// 0x03 - (4B) - vertex count
// 0x07 - (4B) - index count
// 0x0B - (4B) - index type (1b) / index compressed (31b)
//
// == VARIABLE HEADER ==
// ----------------------------------
// -- (1B) - stride                 |
// -- (4B) - vertex compressed size | for each vertex buffer
// ----------------------------------
//
// == COMPRESSED DATA ==
// -- compressed index data
// -- compressed vertices data
//

const FORMAT_ID = 0xAA289;

const calculate_buffer_size = (geometry, indices, vertices) => {
  const V = geometry.attributes.length;
  const fixed_header = 17;
  const variable_header = V * 5;
  const compressed_index_size = indices.size;

  let compressed_vertex_size = 0;
  for (let entry of vertices)
    compressed_vertex_size += entry.size;

  return fixed_header + variable_header + compressed_index_size + compressed_vertex_size;
}

const populate = (output, geometry, indices, vertices) => {
  let offset = 0;
  const dv = new DataView(output.buffer);
  const attrib = geometry.attributes[0];
  const vertex_count = attrib.total_bytes / attrib.stride;

  // = FIXED HEADER =
  dv.setUint32(offset, FORMAT_ID); offset += 4;
  dv.setUint8(offset++, vertices.length);
  dv.setUint32(offset, vertex_count), offset += 4;
  dv.setUint32(offset, geometry.index.data.length); offset += 4;
  const index_type = geometry.index.data.BYTES_PER_ELEMENT == 4 ? 1 : 0;
  dv.setUint32(offset, indices.size | index_type << 31); offset += 4;

  // = VARIABLE HEADER =

  // vertex info
  for (let entry of vertices) {
    dv.setUint8(offset++, entry.stride);
    dv.setUint32(offset, entry.size), offset += 4;
  }

  // = COMPRESSED DATA =

  // compressed index buffer
  memcpy(output, offset, indices.buffer, 0, indices.size);
  offset += indices.size;

  // compressed vertex buffers
  for (let entry of vertices) {
    memcpy(output, offset, entry.buffer, 0, entry.size);
    offset += entry.size;
  }
}

export const compress = (geometry) => {
  const indices = compress_indices(geometry);
  const vertices = compress_vertices(geometry);
 
  const size = calculate_buffer_size(geometry, indices, vertices);
  const output = new Uint8Array(size);
  populate(output, geometry, indices, vertices);

  return output;
}

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
  
  const info = {
    indices: { 
      buffer: null,
      count: index_count,
      type: index_type ? TYPE.u32 : TYPE.u16,
    },
    vertex_count: vertex_count,
    vertices: new Array(vertex_buffers_count),
  };

  // == VARIABLE HEADER =

  // vertex info
  for (let i = 0; i < vertex_buffers_count; ++i) {
    const vertex_size = dv.getUint8(offset++);
    const compressed_size = dv.getUint32(offset); offset += 4;

    info.vertices[i] = {
      input: null,
      vertex_size: vertex_size,
      compressed_size: compressed_size,
      original_size: vertex_count * vertex_size,
    }
  }

  // == COMPRESSED DATA =

  // compressed index buffer
  info.indices.buffer = new Uint8Array(compressed.buffer, offset, index_compressed_size);
  offset += index_compressed_size;

  // compressed vertex buffers
  for (let i = 0; i < vertex_buffers_count; ++i) {
    const vertex = info.vertices[i];
    vertex.input = new Uint8Array(compressed.buffer, offset, vertex.compressed_size);
    offset += vertex.compressed_size;
  }

  return info;
}

export const uncompress = (buffer) => {
  const info = read_file_info(buffer);
  
  const buffers = info.vertices.map(entry => {
    return { type: TYPE.u8, count: entry.original_size }
  });

  buffers.push({
    type: info.indices.type,
    count: info.indices.count + (info.indices.count & 1),
  });

  const mem = Memory.allocate_layout(buffers);
  const indices = uncompress_indices(mem[info.vertices.length], info.indices.buffer);
  for (let i in info.vertices) {
    const vertex = info.vertices[i];
    vertex.output = mem[i];
    uncompress_vertices(mem[i], vertex.input, info.vertex_count, vertex.vertex_size);
  }

  const geometry = new Geometry({
    draw: { count: indices.length },
    index: new BufferData({ data: indices, stride: indices.BYTES_PER_ELEMENT }),
    attributes: info.vertices.map(vert => {
      return new BufferData({ data: vert.output, stride: vert.vertex_size }); 
    }),
  });

  return geometry;
}