
export class EXRExporter {
  static NONE = 0;
  static RLE = 1;
  static ZIPS = 2;
  static ZIP = 3;
  static PIZ = 4;
  static PXR24 = 5;
  static B44 = 6;
  static B44A = 7;
  static DWAA = 8;
  static DWAB = 9;
  constructor() {}
  blob(data, size, options) {
    const buffer = this.buffer(data, size, options);
    return new Blob([buffer], { type: 'image/x-exr' });
  }

  buffer(data, size, options = {}) {
    const width = size.width;
    const height = size.height;
    const input_stride = data.length / (width * height);
    let output_stride;

    if (options.format) {
      switch (options.format) {
        case 'R': output_stride = 1; break;
        case 'RG': output_stride = 2; break;
        case 'RGB': output_stride = 3; break;
        case 'RGBA': output_stride = 4; break;
        default: throw 'EXRExporter: invalid output format.';
      }
      if (input_stride < output_stride) throw `EXRExporter: data provided isn't compatible with specified output format.`;
    } else {
      if (input_stride > 4) throw `EXRExporter: data provided has more than 4 channels - provide target output format.`;
      output_stride = input_stride;
    }

    const { writer, blocks, decoder } = this.#write_header(data, width, height, output_stride, options);
    const chunk = new data.constructor(blocks.width * blocks.height * output_stride);
    const bytes = new Uint8Array(chunk.buffer);
    const tmp = new Uint8Array(bytes.length);

    // reorder
    let line = 0, line_bytes = blocks.width * output_stride * data.BYTES_PER_ELEMENT;
    for (let b = 0; b < blocks.count; b++) {
      const end = line + blocks.height;
      const height = end > size.height ? end % blocks.height : blocks.height;
      for (let i = 0; i < height; i++) {
        for (let ch = 0; ch < output_stride; ch++) {
          const src_line = (line + i) * blocks.width * input_stride;
          const dst_line = i * blocks.width * output_stride + (output_stride - 1 - ch) * blocks.width;
          for (let j = 0; j < blocks.width; j++) chunk[dst_line + j] = data[src_line + j * input_stride + ch];
        }
      }

      const { output, len } = decoder(bytes, tmp, line_bytes * height);
      writer.chunk(output, line, len);
      line += height;
    }

    return writer.bytes.buffer.transferToFixedLength(writer.offset);
  }

  #write_header(data, width, height, stride, options) {

    const compression = options.compression ? options.compression : 0;

    const blocks = {
      width: width,
      height: COMPRESS_BLOCK[compression],
      count: Math.ceil(height / 1),
    };

    const header_bytes = 512 + 64 * stride + 16 * blocks.count + data.byteLength;
    const buffer = new ArrayBuffer(header_bytes, { maxByteLength: header_bytes });
    const writer = new EXRWriter(buffer);

    const type = data.BYTES_PER_ELEMENT == 2 ? 1 : 2;

    writer.u32(20000630);   // magic
    writer.u32(2);          // mask

    // attributes

    writer.string('compression');
    writer.string('compression');
    writer.u32(1);
    writer.u8(compression);

    writer.string('screenWindowCenter');
    writer.string('v2f');
    writer.u32(8);
    writer.u32(0);
    writer.u32(0);

    writer.string('screenWindowWidth');
    writer.string('float');
    writer.u32(4);
    writer.f32(1);

    writer.string('pixelAspectRatio');
    writer.string('float');
    writer.u32(4);
    writer.f32(1);

    writer.string('lineOrder');
    writer.string('lineOrder');
    writer.u32(1);
    writer.u8(0);

    writer.string('dataWindow');
    writer.string('box2i');
    writer.u32(16);
    writer.u32(0);
    writer.u32(0);
    writer.u32(width - 1);
    writer.u32(height - 1);

    writer.string('displayWindow');
    writer.string('box2i');
    writer.u32(16);
    writer.u32(0);
    writer.u32(0);
    writer.u32(width - 1);
    writer.u32(height - 1);

    // channels

    writer.string('channels');
    writer.string('chlist');
    writer.u32(stride * 18 + 1);

    const names = ['A', 'B', 'G', 'R'];

    for (let i = 4 - stride; i < 4; i++) {
      writer.string(names[i]);
      writer.u32(type);
      writer.skip(4);
      writer.u32(1);
      writer.u32(1);
    }

    writer.u8(0);

    // header end

    writer.u8(0);

    // table

    writer.table(blocks.count);

    return { writer, blocks, decoder: decoders[compression] };
  }
}

const raw = (output, tmp, len) => { return { output, len }; };

const rle = (output, tmp, len) => {
  deinterleave(output, tmp, len);

  predictor(tmp, len);

  len = runlength(tmp, output, len);

  return { output, len };
};

const runlength = (src, dst, len) => {
  let rs = 0, re = 1, w = 0;

  while (rs < len) {
    while (re < len && src[rs] == src[re] && re - rs - 1 < 127) re++;

    if (re - rs >= 3) {
      dst[w++] = re - rs - 1;
      dst[w++] = src[((rs << 24) >> 24)];
      rs = re;
    } else {
      while (re < len &&
        ((re + 1 >= len || src[re] != src[re + 1]) ||
          (re + 2 >= len || src[re + 1] != src[re + 2])) &&
        re - rs < 127) re++;

      dst[w++] = rs - re;

      while (rs < re) dst[w++] = src[((rs++ << 24) >> 24)];
    }
    ++re;
  }

  return w;
};

const deinterleave = (src, dst, len) => {
  let t1 = 0, s = 0, t2 = ((len + 1) / 2) | 0;
  const stop = len - 1;

  while (true) {
    if (s > stop) break;
    dst[t1++] = src[s++];
    if (s > stop) break;
    dst[t2++] = src[s++];
  }
};

const predictor = (data, len) => {
  let p = data[0];
  for (let t = 1, tl = len; t < tl; t++) {
    const d = data[t] - p + (128 + 256);
    p = data[t];
    data[t] = d;
  }
};

let _;
const decoders = [raw, rle, _, _, _, _, _, _, _, _];
const COMPRESS_BLOCK = [1, 1, 1, 16, 32, 16, 0, 0, 32, 256];

class EXRWriter {
  constructor(buffer) {
    this.offset = 0;
    this.dv = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.offsets = 0;
    this.encoder = new TextEncoder();
  }

  u8(d) {
    this.dv.setUint8(this.offset, d, true);
    this.offset += 1;
  };

  i8(d) {
    this.dv.setInt8(this.offset, d, true);
    this.offset += 1;
  };

  u16(d) {
    this.dv.setUint16(this.offset, d, true);
    this.offset += 2;
  };

  i16(d) {
    this.dv.setInt16(this.offset, d, true);
    this.offset += 2;
  };

  u32(d) {
    this.dv.setUint32(this.offset, d, true);
    this.offset += 4;
  };

  i32(d) {
    this.dv.setInt32(this.offset, d, true);
    this.offset += 4;
  };

  f32(d) {
    this.dv.setFloat32(this.offset, d, true);
    this.offset += 4;
  };

  f64(d) {
    this.dv.setFloat64(this.offset, d, true);
    this.offset += 8;
  };

  string(str) {
    const charstr = this.encoder.encode(str + '\0');
    for (let i = 0; i < charstr.length; i++) this.u8(charstr[i]);
  }

  table(blocks) {
    this.offset_table = this.offset;
    this.skip(8 * blocks);
  }

  chunk(chunk, line, bytes) {
    const offset = BigInt(this.offset);
    this.dv.setBigUint64(this.offset_table, offset, true);
    this.offset_table += 8;
    this.i32(line);
    this.i32(bytes);
    this.bytes.set(chunk, this.offset, bytes);
    this.offset += bytes;
  }

  skip(b) { this.offset += b; }
}