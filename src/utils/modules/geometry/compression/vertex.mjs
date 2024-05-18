import { Memory, memcpy } from "../common/memory.mjs";
import { TYPE, i8 } from "../common/type.mjs";

const BLOCK_SIZE_BYTES = 8192;
const BLOCK_MAX_SIZE = 1024;
const GROUP_SIZE = 32;

const zigzag8 = (v) => (i8(v) >> 7) ^ (v << 1);
const unzigzag8 = (v) => -(v & 1) ^ (v >> 1);

const calculate_block_size = (vertex_size) => {
  let result = BLOCK_SIZE_BYTES / vertex_size;
  result &= ~(GROUP_SIZE - 1);
  return result < BLOCK_MAX_SIZE ? result : BLOCK_MAX_SIZE;
}

const calculate_buffer_size = (vertex_count, vertex_size) => {
  const vertex_block_size = calculate_block_size(vertex_size);
  const vertex_block_count = ((vertex_count + vertex_block_size - 1) / vertex_block_size) | 0;
  const vertex_block_header_size = (vertex_block_size / GROUP_SIZE + 1) / 2 | 0;
  return vertex_block_count * vertex_size * (vertex_block_header_size + vertex_block_size) + vertex_size;
}

const calculate_group_size = (buffer, offset, bits, max) => {
  let result = GROUP_SIZE * bits / 8;
  const sentinel = (1 << bits) - 1;
 
  if (bits == 1) {
    if (!max)
      return { size: 0, spow: 0 };
  } else {
    if (max <= sentinel)
      return { size: result, spow: 0 };
  }

  const spow = max > 0xf ? 3 : (max > 0x3 ? 2 : 1);

  let count = 0;
  for (let i = 0; i < GROUP_SIZE; ++i)
    count += buffer[offset + i] >= sentinel;

  const total = ((count * (1 << spow) + 7) & (~7)) / 8;
  return { size: total + result, spow: spow };
}

const encode_group = (encode_info, buffer_base, bits, spow) => {
  let { buffer, output, output_offset } = encode_info;

  if (bits == 1 && spow == 0)
    return;

  if (bits == 8) {
    memcpy(output, output_offset, buffer, buffer_base, GROUP_SIZE);
    encode_info.output_offset += GROUP_SIZE;
    return;
  }

  const byte_size = 8 / bits;
  const sentinel = (1 << bits) - 1;

  for (let i = 0; i < GROUP_SIZE; i += byte_size) {
    let byte = 0;
    for (let k = 0; k < byte_size; ++k) {
      const val = buffer[buffer_base + i + k] 
      const enc = val >= sentinel ? sentinel : val;

      byte <<= bits;
      byte |= enc;
    }
    output[output_offset++] = byte;
  }
  
  if (spow == 0) {
    encode_info.output_offset = output_offset;
    return;
  }

  let acc_bits = 0;
  const sbits = 1 << spow;
  for (let i = 0; i < GROUP_SIZE; ++i) {
    const val = buffer[buffer_base + i];
    if (val >= sentinel) {
      acc_bits += sbits;
      output[output_offset] |= val << (8 - acc_bits);
      if (acc_bits == 8) {
        output_offset++;
        acc_bits = 0;
      }
    }
  }

  if (acc_bits)
    output_offset++;

  encode_info.output_offset = output_offset;
}

const encode_buffer = (encode_info, buffer_size) => {
  const { buffer, output, output_offset } = encode_info;

  const header_size = (buffer_size / GROUP_SIZE + 1) / 2 | 0;
  const header_base = output_offset;

  encode_info.output_offset += header_size;
  output.fill(0, header_base, encode_info.output_offset);

  for (let i = 0; i < buffer_size; i += GROUP_SIZE) {
    let best_bits = 8;
    let best_pow = 3;
    let best_spow = 0;
    let best_size = GROUP_SIZE;

    let max = 0;
    for (let k = 0; k < GROUP_SIZE; k++) 
      max = max < buffer[i + k] ? buffer[i + k] : max;

    for (let p = 0; p < 3; ++p) {
      const bits = 1 << p;
      const { size, spow } = calculate_group_size(buffer, i, bits, max);
      if (size <= best_size) {
        best_pow = p;
        best_bits = bits;
        best_size = size;
        best_spow = spow;
      }
    }

    const header_offset = i / GROUP_SIZE;
    const header_entry = (best_pow << 2) | best_spow;
    output[header_base + header_offset / 2 | 0] |= header_entry << ((header_offset % 2) * 4);
    encode_group(encode_info, i, best_bits, best_spow);
  }
}

const encode_block = (encode_info) => {
  const { buffer, input, input_offset, last_vertex, vertex_size, block_size } = encode_info;

  buffer.fill(0);
  for (let k = 0; k < vertex_size; ++k) {
    let vertex_offset = k;
    let p = last_vertex[k];
    
    for (let i = 0; i < block_size; ++i) {
      const byte = input[input_offset + vertex_offset];
      buffer[i] = zigzag8(byte - p);
      p = byte;
      vertex_offset += vertex_size;
    }

    encode_buffer(encode_info, (block_size + GROUP_SIZE - 1) & ~(GROUP_SIZE - 1));
  }

  memcpy(last_vertex, 0, input, input_offset + (block_size - 1) * vertex_size, vertex_size);
}

const encode_vertex = (output, input, vertex_count, vertex_size) => {
  const vertex_block_size = calculate_block_size(vertex_size);

  const mem = {
    buffer:       { type: TYPE.u8, count: BLOCK_MAX_SIZE },
    first_vertex: { type: TYPE.u8, count: 256 },
    last_vertex:  { type: TYPE.u8, count: 256 },
  }

  const {first_vertex, last_vertex, buffer} = Memory.allocate_layout(mem);
  
  memcpy(first_vertex, 0, input, 0, vertex_size);
  memcpy(last_vertex, 0, input, 0, vertex_size);
  
  let vertex_offset = 0;
  const encode_info = {
    buffer: buffer,
    input: input,
    input_offset: 0,
    output: output,
    output_offset: 0,
    block_size: null,
    vertex_size: vertex_size,
    last_vertex: last_vertex
  };

  while (vertex_offset < vertex_count) {
    encode_info.block_size = (vertex_block_size + vertex_offset) < vertex_count ? vertex_block_size : vertex_count - vertex_offset;
    encode_info.input_offset = vertex_offset * vertex_size;
    encode_block(encode_info);
    vertex_offset += encode_info.block_size;
  }

  memcpy(output, encode_info.output_offset, first_vertex, 0, vertex_size);
  encode_info.output_offset += vertex_size;

  return { buffer: output, size: encode_info.output_offset };
}

export const compress_vertices = (geometry) => {
  const buffers = geometry.attributes.map(buf => {
    return { buffer: buf.data, stride: buf.stride }
  });

  const attrib = geometry.attributes[0];
  const vertex_count = attrib.total_bytes / attrib.stride;

  const mem = buffers.map(entry => {
    return { 
      type: TYPE.u8, 
      count: calculate_buffer_size(vertex_count, entry.stride)
    }
  });

  const blocks = Memory.allocate_layout(mem);
  const outputs = new Array(blocks.length);
  for (let i in blocks) {
    const e = buffers[i];
    outputs[i] = {
      ...encode_vertex(blocks[i], e.buffer, vertex_count, e.stride),
      stride: e.stride
    };
  }

  return outputs;
}

const decode_group = (decode_info, buffer_offset, pow, spow) => {
  const { buffer, input } = decode_info;
  switch (pow) {
    case 8:
      memcpy(buffer, buffer_offset, input, decode_info.input_offset, GROUP_SIZE);
      decode_info.input_offset += GROUP_SIZE;
      break;
    case 0:
      if (spow == 0) {
        buffer.fill(0, buffer_offset, buffer_offset + GROUP_SIZE);
        break;
      }
    default:
      const bits = 1 << pow;
      const byte_size = 8 / bits;
      const sentinel = (1 << bits) - 1;
      let sentinel_offset = decode_info.input_offset + GROUP_SIZE / byte_size;

      if (!spow) {
        for (let i = 0; i < GROUP_SIZE; i+=byte_size) {
          let byte = input[decode_info.input_offset++];
          for (let k = 0; k < byte_size; ++k) {
            const enc = (byte >> (8 - bits)) & sentinel;
            buffer[buffer_offset++] = enc;
            byte <<= bits;
          }
        }
      } else {
        const sbits = 1 << spow;
        const mask = (1 << sbits) - 1;
        let acc_bits = 0;
        let sbyte = input[sentinel_offset];
        
        for (let i = 0; i < GROUP_SIZE; i+=byte_size) {
          let byte = input[decode_info.input_offset++];
          for (let k = 0; k < byte_size; ++k) {
            const enc = (byte >> (8 - bits)) & sentinel;
            byte <<= bits;
            if (enc == sentinel) {
              acc_bits += sbits;
              const val = (sbyte >> (8 - acc_bits)) & mask;
              buffer[buffer_offset++] = val;
              if (acc_bits == 8) {
                acc_bits = 0;
                sbyte = input[++sentinel_offset];
              }
            } else {
              buffer[buffer_offset++] = enc;
            }
          }
        }

        if (acc_bits) 
          sentinel_offset++;
      }

      decode_info.input_offset = sentinel_offset;
  }
}

const decode_buffer = (decode_info, buffer_size) => {
  const header_size = (buffer_size / GROUP_SIZE + 1) / 2 | 0;
  const header_base = decode_info.input_offset;

  decode_info.input_offset += header_size;
  for (let i = 0; i < buffer_size; i += GROUP_SIZE) {
    const header_offset = i / GROUP_SIZE;
    const header = (decode_info.input[header_base + header_offset / 2 | 0] >> ((header_offset&1) * 4));
    const spow = header & 3;
    const pow = (header >> 2) & 3;
    decode_group(decode_info, i, pow, spow);
  }
}

const decode_block = (decode_info) => {
  let { output, output_offset, buffer, transposed, vertex_size, block_size, last_vertex } = decode_info;
  const vertex_count_aligned = (block_size + GROUP_SIZE - 1) & ~(GROUP_SIZE - 1);

  for (let k = 0; k < vertex_size; ++k) {
    decode_buffer(decode_info, vertex_count_aligned);
    
    let p = last_vertex[k];
    let vertex_offset = k;
    for (let i = 0; i < block_size; ++i) {
      transposed[vertex_offset] = p = unzigzag8(buffer[i]) + p;
      vertex_offset += vertex_size;
    }
  }

  memcpy(output, output_offset, transposed, 0, block_size * vertex_size);
  memcpy(last_vertex, 0, transposed, vertex_size * (block_size - 1), vertex_size);
}

export const uncompress_vertices = (output, input, vertex_count, vertex_size) => {
  const input_size = input.length;
  const vertex_block_size = calculate_block_size(vertex_size);

  const mem = {
    buffer:       { type: TYPE.u8, count: BLOCK_MAX_SIZE },
    last_vertex:  { type: TYPE.u8, count: BLOCK_MAX_SIZE },
    transposed:   { type: TYPE.u8, count: BLOCK_SIZE_BYTES },
  }
  
  const {last_vertex, buffer, transposed} = Memory.allocate_layout(mem);

  const decode_info = {
    buffer: buffer,
    transposed: transposed,
    input: input,
    input_offset: 0,
    output: output,
    output_offset: 0,
    vertex_size: vertex_size,
    last_vertex: last_vertex,
    block_size: null,
  }

  memcpy(decode_info.last_vertex, 0, input, input_size - vertex_size, vertex_size);

  let vertex_offset = 0;
  while (vertex_offset < vertex_count) {
    decode_info.block_size = (vertex_offset + vertex_block_size < vertex_count) ? vertex_block_size : vertex_count - vertex_offset;
    decode_info.output_offset = vertex_offset * vertex_size;
    decode_block(decode_info);
    vertex_offset += decode_info.block_size;
  }

  return decode_info.output;
}