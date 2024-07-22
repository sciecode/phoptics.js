import { Memory } from "../common/memory.mjs";
import { TYPE, u8, u32, i32 } from "../common/type.mjs";

const FECMAX = 13;

const ORDER = [
  0, 1, 2,
  1, 2, 0,
  2, 0, 1
];

const CODE_TABLE = [
  0x00, 0x76, 0x87, 0x56, 0x67, 0x78, 0xa9, 0x86, 0x65, 0x89, 0x68, 0x98, 0x01, 0x69, 0, 0,
];

const calculate_buffer_size = (index_count, vertex_count) => {
  // compute number of bits required for each index
  let vertex_bits = 1;

  while (vertex_bits < 32 && vertex_count > (1 << vertex_bits))
    vertex_bits++;

  // worst-case encoding is 2 header bytes + 3 varint-7 encoded index deltas
  let vertex_groups = ((vertex_bits + 1 + 6) / 7) | 0;

  return (index_count / 3) * (2 + 3 * vertex_groups) + 16;
};

const get_codeaux_index = (v) => {
  for (let i = 0; i < 16; ++i)
    if (CODE_TABLE[i] == v)
      return i;

  return -1;
};

const get_edge = (info, a, b, c) => {
  for (let i = 0; i < 16; ++i) {
    const index = (info.edge_offset - 1 - i) & 15;
    const i2 = index * 2;

    const e0 = info.edge_fifo[i2], e1 = info.edge_fifo[i2 + 1];

    if (e0 == a && e1 == b) return (i << 2) | 0;
    if (e0 == b && e1 == c) return (i << 2) | 1;
    if (e0 == c && e1 == a) return (i << 2) | 2;
  }

  return -1;
};

const get_vertex = (info, v) => {
  for (let i = 0; i < 16; ++i) {
    const index = (info.vertex_offset - 1 - i) & 15;

    if (info.vertex_fifo[index] == v)
      return i;
  }

  return -1;
};

const push_edge = (info, a, b) => {
  const i2 = info.edge_offset * 2;
  info.edge_fifo[i2] = a;
  info.edge_fifo[i2 + 1] = b;
  info.edge_offset = (info.edge_offset + 1) & 15;
};

const push_vertex = (info, v, cond = 1) => {
  info.vertex_fifo[info.vertex_offset] = v;
  info.vertex_offset = (info.vertex_offset + cond) & 15;
};

const encode_varbyte = (info, index, last) => {
  const d = u32(index - last);
  let v = u32((d << 1) ^ (d >> 31));

  // encode 32-bit value in up to 5 7-bit groups
  do {
    info.output[info.data_offset++] = (v & 127) | (v > 127 ? 128 : 0);
    v >>>= 7;
  } while (v);
};

const decode_varbyte = (info, last) => {
  let v = info.input[info.data_offset++];

  if (v >= 128) {
    v &= 127;
    let shift = 7;

    for (let i = 0; i < 4; ++i) {
      const group = info.input[info.data_offset++];
      v |= (group & 127) << shift;
      shift += 7;

      if (group < 128)
        break;
    }
  }

  v = u32(v);
  const d = (v >>> 1) ^ -i32(v & 1);

  return last + d;
};

const write_triangle = (info, idx, a, b, c) => {
  info.output[idx] = a;
  info.output[idx + 1] = b;
  info.output[idx + 2] = c;
};

export const encode_indices = (output, indices, index_count) => {
  const mem = {
    edge_fifo: { type: TYPE.u32, count: 32 },
    vertex_fifo: { type: TYPE.u32, count: 16 },
  };

  const info = Memory.allocate_layout(mem);

  info.edge_fifo.fill(-1);
  info.vertex_fifo.fill(-1);

  info.output = output;
  info.edge_offset = 0;
  info.vertex_offset = 0;
  info.code_offset = 0;
  info.data_offset = index_count / 3;

  let next = 0;
  let last = 0;

  for (let i = 0; i < index_count; i += 3) {

    const fer = get_edge(info, indices[i + 0], indices[i + 1], indices[i + 2]);

    if (fer >= 0 && (fer >> 2) < 15) {
      const o3 = (fer & 3) * 3;
      const a = indices[i + ORDER[o3 + 0]];
      const b = indices[i + ORDER[o3 + 1]];
      const c = indices[i + ORDER[o3 + 2]];

      // encode edge index and vertex fifo index, next or free index
      const fe = fer >> 2;
      const fc = get_vertex(info, c);
      let fec = (fc >= 1 && fc < FECMAX) ? fc : (c == next) ? (next++, 0) : 15;

      if (fec == 15) {
        // encode last-1 and last+1 to optimize strip-like sequences
        if (c + 1 == last) {
          fec = 13; last = c;
        }
        if (c == last + 1) {
          fec = 14; last = c;
        }
      }

      output[info.code_offset++] = u8((fe << 4) | fec);

      // note that we need to update the last index since free indices are delta-encoded
      if (fec == 15) {
        encode_varbyte(info, c, last);
        last = c;
      }

      // we only need to push third vertex since first two are likely already in the vertex fifo
      if (fec == 0 || fec >= FECMAX)
        push_vertex(info, c);

      // we only need to push two new edges to edge fifo since the third one is already there
      push_edge(info, c, b);
      push_edge(info, a, c);
    } else {
      let reset = false;
      const rotation = (indices[i + 1] == next) ? 1 : (indices[i + 2] == next) ? 2 : 0;

      const o3 = rotation * 3;
      const a = indices[i + ORDER[o3 + 0]];
      const b = indices[i + ORDER[o3 + 1]];
      const c = indices[i + ORDER[o3 + 2]];

      if (a == 0 && b == 1 && c == 2 && next > 0) {
        info.vertex_fifo.fill(-1);
        reset = true;
        next = 0;
      }

      const fb = get_vertex(info, b);
      const fc = get_vertex(info, c);

      // after rotation, a is almost always equal to next, so we don't waste bits on FIFO encoding for a
      const fea = (a == next) ? (next++, 0) : 15;
      const feb = (fb >= 0 && fb < 14) ? (fb + 1) : (b == next) ? (next++, 0) : 15;
      const fec = (fc >= 0 && fc < 14) ? (fc + 1) : (c == next) ? (next++, 0) : 15;

      // we encode feb & fec in 4 bits using a table if possible, and as a full byte otherwise
      const codeaux = u8((feb << 4) | fec);
      const codeauxindex = get_codeaux_index(codeaux);

      // <14 encodes an index into codeaux table, 14 encodes fea=0, 15 encodes fea=15
      if (fea == 0 && codeauxindex >= 0 && codeauxindex < 14 && !reset) {
        output[info.code_offset++] = u8((15 << 4) | codeauxindex);
      } else {
        output[info.code_offset++] = u8((15 << 4) | 14 | fea);
        output[info.data_offset++] = codeaux;
      }

      if (fea == 15) {
        encode_varbyte(info, a, last);
        last = a;
      }

      if (feb == 15) {
        encode_varbyte(info, b, last);
        last = b;
      }

      if (fec == 15) {
        encode_varbyte(info, c, last);
        last = c;
      }

      if (fea == 0 || fea == 15)
        push_vertex(info, a);

      if (feb == 0 || feb == 15)
        push_vertex(info, b);

      if (fec == 0 || fec == 15)
        push_vertex(info, c);

      push_edge(info, b, a);
      push_edge(info, c, b);
      push_edge(info, a, c);
    }
  }

  return info.data_offset;
};

export const compress_indices = (geometry) => {
  const index_count = geometry.index.count;
  const vertex_count = geometry.attributes.elements;

  const output = {
    size: null,
    buffer: new Uint8Array(calculate_buffer_size(index_count, vertex_count)),
  };

  output.size = encode_indices(output.buffer, geometry.index.data, index_count);

  return output;
};

export const uncompress_indices = (output, input, index_count) => {
  const mem = {
    edge_fifo: { type: TYPE.u32, count: 32 },
    vertex_fifo: { type: TYPE.u32, count: 16 },
  };

  const info = Memory.allocate_layout(mem);

  info.edge_fifo.fill(-1);
  info.vertex_fifo.fill(-1);

  info.output = output;
  info.input = input;
  info.edge_offset = 0;
  info.vertex_offset = 0;
  info.code_offset = 0;
  info.data_offset = index_count / 3;

  let next = 0;
  let last = 0;

  for (let i = 0; i < index_count; i += 3) {
    const code_tri = info.input[info.code_offset++];

    if (code_tri < 0xf0) {

      const fe = code_tri >> 4;

      const edge_index = ((info.edge_offset - 1 - fe) & 15) * 2;

      const a = info.edge_fifo[edge_index];
      const b = info.edge_fifo[edge_index + 1];

      const fec = code_tri & 15;

      // note: this is the most common path in the entire decoder
      // inside this if we try to stay branchless (by using cmov/etc.) since these aren't predictable
      if (fec < FECMAX) {
        // fifo reads are wrapped around 16 entry buffer
        const cf = info.vertex_fifo[(info.vertex_offset - 1 - fec) & 15];
        const c = (fec == 0) ? next : cf;

        const fec0 = fec == 0;
        next += fec0;

        // output triangle
        write_triangle(info, i, a, b, c);

        // push vertex/edge fifo must match the encoding step *exactly* otherwise the data will not be decoded correctly
        push_vertex(info, c, fec0);

        push_edge(info, c, b);
        push_edge(info, a, c);
      } else {
        let c = 0;

        // fec - (fec ^ 3) decodes 13, 14 into -1, 1
        // note that we need to update the last index since free indices are delta-encoded
        last = c = (fec != 15) ? last + (fec - (fec ^ 3)) : decode_varbyte(info, last);

        // output triangle
        write_triangle(info, i, a, b, c);

        // push vertex/edge fifo must match the encoding step *exactly* otherwise the data will not be decoded correctly
        push_vertex(info, c);

        push_edge(info, c, b);
        push_edge(info, a, c);
      }

    } else {
      // fast path: read codeaux from the table
      if (code_tri < 0xfe) {
        const code_aux = CODE_TABLE[code_tri & 15];

        // note: table can't contain feb/fec=15
        const feb = code_aux >> 4;
        const fec = code_aux & 15;

        // fifo reads are wrapped around 16 entry buffer
        // also note that we increment next for all three vertices before decoding indices - this matches encoder behavior
        const a = next++;

        const bf = info.vertex_fifo[(info.vertex_offset - feb) & 15];
        const b = (feb == 0) ? next : bf;

        const feb0 = feb == 0;
        next += feb0;

        const cf = info.vertex_fifo[(info.vertex_offset - fec) & 15];
        const c = (fec == 0) ? next : cf;

        const fec0 = fec == 0;
        next += fec0;

        // output triangle
        write_triangle(info, i, a, b, c);

        // push vertex/edge fifo must match the encoding step *exactly* otherwise the data will not be decoded correctly
        push_vertex(info, a);
        push_vertex(info, b, feb0);
        push_vertex(info, c, fec0);

        push_edge(info, b, a);
        push_edge(info, c, b);
        push_edge(info, a, c);
      } else {
        // slow path: read a full byte for codeaux instead of using a table lookup
        const code_aux = info.input[info.data_offset++];

        const fea = code_tri == 0xfe ? 0 : 15;
        const feb = code_aux >> 4;
        const fec = code_aux & 15;

        // reset: codeaux is 0 but encoded as not-a-table
        if (code_aux == 0)
          next = 0;

        // fifo reads are wrapped around 16 entry buffer
        // also note that we increment next for all three vertices before decoding indices - this matches encoder behavior
        let a = (fea == 0) ? next++ : 0;
        let b = (feb == 0) ? next++ : info.vertex_fifo[(info.vertex_offset - feb) & 15];
        let c = (fec == 0) ? next++ : info.vertex_fifo[(info.vertex_offset - fec) & 15];

        // note that we need to update the last index since free indices are delta-encoded
        if (fea == 15) last = a = decode_varbyte(info, last);
        if (feb == 15) last = b = decode_varbyte(info, last);
        if (fec == 15) last = c = decode_varbyte(info, last);

        // output triangle
        write_triangle(info, i, a, b, c);

        // push vertex/edge fifo must match the encoding step *exactly* otherwise the data will not be decoded correctly
        push_vertex(info, a);
        push_vertex(info, b, (feb == 0) | (feb == 15));
        push_vertex(info, c, (fec == 0) | (fec == 15));

        push_edge(info, b, a);
        push_edge(info, c, b);
        push_edge(info, a, c);
      }
    }
  }

  return output;
};