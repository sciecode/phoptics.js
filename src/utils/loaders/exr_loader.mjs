import { decode_f16 } from 'phoptics/utils/data/decoder.mjs';
import { Decompressor } from 'phoptics-deflate';

export class EXRLoader {
  constructor(debug) { this.debug = debug; };

  load(url) {
    return fetch(url).then( async response => {
      if (!response.ok) return undefined;
      return this.parse(await response.arrayBuffer(), this.debug);
    });
  }

  parse(buffer, debug) {
    const view = new EXRView(buffer);
    const { header, decoder, info } = read_header(view);
    if (debug) console.log(header);
    const output = decoder(info);
    return output;
  }
}

const read_header = (view) => {
  if (view.u32() != 20000630) throw 'EXRLoader: file not OpenEXR format.';

  const header = {};
  header.version = view.u8();

  const spec = view.u8();
  header.spec = {
    tiled: !! ( spec & 2 ),
    deep: !! ( spec & 8 ),
    multi: !! ( spec & 16 ),
  };

  view.skip(2); // preamble

  let name;
  const att = header.attributes = {};
  while (name = view.string()) {
    const type = view.string();
    const size = view.u32();
    att[name] = view.attribute(type, size);
  }

  const size = {
    width: att.dataWindow.max[0] - att.dataWindow.min[0] + 1,
    height: att.dataWindow.max[1] - att.dataWindow.min[1] + 1,
  }, block = {
    width: size.width,
    height: att.compression.height,
    count: Math.ceil(size.height / att.compression.height)
  }, channels = {
    input: {
      info: att.channels,
      stride: 0
    },
    output: {
      info: {},
      stride: 0,
      count: 0,
    }
  }

  for (let ch of att.channels) {
    switch (ch.name) {
      case 'R':
      case 'G':
      case 'B':
      case 'A':
        channels.output.info[ch.name] = { stride: channels.output.stride, bytes: ch.type * 2 };
        channels.output.stride += ch.type * 2;
        channels.output.count++;
      default:
        channels.input.stride += ch.type * 2;
    }
  }

  // offsets
  let il = block.count; while (il--) view.i64();

  const type = (att.channels[0].type == 1) ? Uint16Array : Float32Array;
  const decoder = att.compression.decoder;
  const info = {
    type: type,
    size,
    block,
    channels,
    view,
  }

  return { header, decoder, info };
}

const zlib = (info) => {
  const { type, size, block, channels, view } = info;
  const output = new type(size.width * size.height * channels.output.stride / type.BYTES_PER_ELEMENT);
  console.log(info, output);
}

class EXRView {
  constructor(buffer) {
    this.offset = 0;
    this.dv = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.decoder = new TextDecoder();
  }

  u8()  {
    const v = this.dv.getUint8(this.offset, true)
    this.offset += 1;
    return v;
  };

  i8()  {
    const v = this.dv.getInt8(this.offset, true)
    this.offset += 1;
    return v;
  };

  u16()  {
    const v = this.dv.getUint16(this.offset, true)
    this.offset += 2;
    return v;
  };

  i16()  {
    const v = this.dv.getInt16(this.offset, true)
    this.offset += 2;
    return v;
  };

  u32()  {
    const v = this.dv.getUint32(this.offset, true)
    this.offset += 4;
    return v;
  };

  i32()  {
    const v = this.dv.getInt32(this.offset, true)
    this.offset += 4;
    return v;
  };

  u64()  {
    const v = this.dv.getBigUint64(this.offset, true)
    this.offset += 8;
    return v;
  };

  i64()  {
    const v = this.dv.getBigInt64(this.offset, true)
    this.offset += 8;
    return v;
  };

  f16()  {
    const v = decode_f16(this.dv.getUint16(this.offset, true))
    this.offset += 2;
    return v;
  };

  f32()  {
    const v = this.dv.getFloat32(this.offset, true)
    this.offset += 4;
    return v;
  };

  f64()  {
    const v = this.dv.getFloat64(this.offset, true)
    this.offset += 8;
    return v;
  };

  string() {
    let start = this.offset;
    while (this.bytes[this.offset++] != 0);
    return this.decoder.decode(this.bytes.slice(start, this.offset - 1));;
  }

  string_len(len) {
    let start = this.offset;
    this.offset += len;
    return this.decoder.decode(this.bytes.slice(start, this.offset));
  }

  channels(len) {
    const channels = [], end = this.offset + len - 1;
    while (this.offset < end) {
      channels.push({
        name: this.string(),
        type: this.i32(),
        linear: this.u8(),
        sampling: this.skip(3) || [this.i32(), this.i32()]
      });
    }
    this.skip(1);
    return channels;
  }

  attribute(type, len) {
    let code;
    switch(type) {
      case 'float': return this.f32();
      case 'int': return this.i32();
      case 'v2f': return [this.f32(), this.f32()];
      case 'v3f': return [this.f32(), this.f32(), this.f32()];
      case 'box2i': return { min: [this.i32(), this.i32()], max: [this.i32(), this.i32()] };
      case 'compression': return { name: compressions[code = this.u8()], decoder: decoders[code], height: COMPRESS_BLOCK[code] };
      case 'lineOrder': return { name: orders[code = this.u8()], code };
      case 'chlist': return this.channels(len);
      case 'string': return this.string_len(len);
      default:
        this.offset += len;
        return type + "/skipped";
    }
  }

  skip(b) { this.offset += b }
}

const ORDERS = { UP: 0, DOWN: 1, RAND: 2 };
const orders = ['INCREASING_Y','DECREASING_Y','RANDOM_Y'];
let _;
const decoders = [_, _, zlib, zlib, _, _, _, _, _, _];
const COMPRESS_BLOCK = [1, 1, 1, 16, 32, 16, 0, 0, 32, 256];
const compressions = ['NO','RLE','ZIPS','ZIP','PIZ','PXR24','B44','B44A','DWAA','DWAB'];