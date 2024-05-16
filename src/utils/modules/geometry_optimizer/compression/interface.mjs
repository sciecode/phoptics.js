import { TYPE } from '../common/type.mjs';
import { Geometry } from "../../geometry.mjs";
import { Memory, memcpy } from "../common/memory.mjs";
import { compress_vertices, uncompress_vertices } from "./vertex.mjs";
import { compress_indices, uncompress_indices } from './index.mjs';

// == HEADER ==
// 0x00 - (1B) - format ID
// 0x01 - (1B) - vertex buffer count
// 0x02 - (1B) - groups count
// 0x03 - (1B) - attributes count
// 0x04 - (4B) - vertex count
// 0x08 - (4B) - index count
// 0x0C - (4B) - index type (1b) / index compressed (31b)
//
// == VARIABLE HEADER ==
// ----------------------------------
// -- (1B) - stride                 |
// -- (4B) - vertex compressed size | for each vertex buffer
// ----------------------------------
// -- (4B) - offset                 |
// -- (4B) - count                  | for each group
// ----------------------------------
// -- (16B) - name                  |
// -- (1B)  - bID (4b) / type (4b)  |
// -- (1B)  - item count            | for each attribute
// -- (1B)  - stride                |
// -- (1B)  - offset                |
// ----------------------------------
//
// == COMPRESSED DATA ==
// -- compressed index data
// -- compressed vertices data
//

const FORMAT_ID = 0x65;

const bytes_to_human = (bytes) => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes == 0) return '0 B';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  if (i == 0) return bytes + ' ' + sizes[i];
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
};

const calculate_buffer_size = (geometry, indices, vertices) => {
  const V = geometry.buffers.length;
  const G = geometry.groups.length;
  const A = geometry.attributes.size;

  const fixed_header = 16;
  const variable_header = V * 5 + G * 8 + A * 20;
  const compressed_index_size = indices.size;

  let compressed_vertex_size = 0;
  for (let entry of vertices)
    compressed_vertex_size += entry.size;

  return fixed_header + variable_header + compressed_index_size + compressed_vertex_size;
}

const populate = (output, geometry, indices, vertices) => {
  let offset = 0;
  const dv = new DataView(output.buffer);
  const encoder = new TextEncoder();

  // = FIXED HEADER =
  dv.setUint8(offset++, FORMAT_ID);
  dv.setUint8(offset++, vertices.length);
  dv.setUint8(offset++, geometry.groups.length);
  dv.setUint8(offset++, geometry.attributes.size);
  dv.setUint32(offset, geometry.vertex_count), offset += 4;

  dv.setUint32(offset, geometry.indices.length); offset += 4;
  const index_type = geometry.indices.BYTES_PER_ELEMENT == 4 ? 1 : 0;
  dv.setUint32(offset, indices.size | index_type << 31); offset += 4;

  // = VARIABLE HEADER =

  // vertex info
  for (let entry of vertices) {
    dv.setUint8(offset++, entry.stride);
    dv.setUint32(offset, entry.size), offset += 4;
  }

  // groups info
  for (let group of geometry.groups) {
    dv.setUint32(offset, group.offset), offset += 4;
    dv.setUint32(offset, group.count), offset += 4;
  }

  // attributes info
  for (let [name,attrib] of geometry.attributes) {
    output.set(encoder.encode(attrib.name), offset), offset += 16;
    dv.setUint8(offset++, attrib.buffer_id << 4 | attrib.type.id);
    dv.setUint8(offset++, attrib.count);
    dv.setUint8(offset++, attrib.stride);
    dv.setUint8(offset++, attrib.offset);
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

  let original_size = 0, compressed_size = 0;
  for (let i in vertices) {
    original_size += geometry.buffers[i].length;
    compressed_size += vertices[i].size;
  }
  console.log(
    "vertex_compression --",
    "original:", bytes_to_human(original_size) + ",",
    "compressed:", bytes_to_human(compressed_size) + ",",
    "ratio:", (compressed_size / original_size).toFixed(3)
  );
    
  const size = calculate_buffer_size(geometry, indices, vertices);
  
  const output = new Uint8Array(size);
  populate(output, geometry, indices, vertices);

  return output;
}

const read_file_info = (compressed) => {
  let offset = 1;
  const dv = new DataView(compressed.buffer);
  const decoder = new TextDecoder();
  
  // == FIXED HEADER =
  let vertex_buffers_count = dv.getUint8(offset++);
  let groups_count = dv.getUint8(offset++);
  let attributes_count = dv.getUint8(offset++);
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
    groups: new Array(groups_count),
    attributes: new Array(attributes_count),
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

  // groups info
  for (let i = 0; i < groups_count; ++i) {
    const start = dv.getUint32(offset); offset += 4;
    const count = dv.getUint32(offset); offset += 4;
    info.groups[i] = {
      offset: start,
      count: count
    }
  }

  // attributes info
  for (let i = 0; i < attributes_count; ++i) {
    let len = 0;
    while (len < 16 && compressed[offset+len]) len++;
    const name = decoder.decode(compressed.subarray(offset,offset+len)); offset += 16;
    const byte = dv.getUint8(offset++);
    const buffer_id = byte >> 4;
    const type = byte & 0xf;
    const count = dv.getUint8(offset++);
    const stride = dv.getUint8(offset++);
    const start = dv.getUint8(offset++);
    info.attributes[i] = {
      name: name,
      buffer_id: buffer_id,
      type:  TYPE.from_id(type),
      count: count,
      stride: stride,
      offset: start,
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
  if (buffer[0] != FORMAT_ID)
    throw "Phoptics::uncompress: Invalid file format.";

  const geometry = new Geometry();
  const info = read_file_info(buffer);

  const buffers = info.vertices.map(entry => {
    return { type: TYPE.u8, count: entry.original_size }
  });

  buffers.push({
    type: info.indices.type,
    count: info.indices.count,
  });

  const mem = Memory.allocate_layout(buffers);

  geometry.set_indices(uncompress_indices(mem[info.vertices.length], info.indices.buffer));

  for (let i in info.vertices) {
    const vertex = info.vertices[i];
    geometry.add_buffer(uncompress_vertices(mem[i], vertex.input, info.vertex_count, vertex.vertex_size));
  }

  for (let group of info.groups)
    geometry.add_group(group.offset, group.count);

  for (let attrib of info.attributes)
    geometry.add_attribute(attrib.name, attrib.buffer_id, attrib.type, attrib.count, attrib.stride, attrib.offset);

  return geometry;
}