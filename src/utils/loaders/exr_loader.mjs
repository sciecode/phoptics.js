import { decode_f16 } from 'phoptics/utils/data/decoder.mjs';

export class EXRLoader {
  constructor() {
    this.worker_pool = new WorkerPool();
  };

  async load(url) {
    return fetch(url).then( async response => {
      if (!response.ok) return undefined;
      return this.parse(await response.arrayBuffer());
    });
  }

  async parse(buffer) {
    const reader = new EXRReader(buffer);
    const { header, info } = read_header(reader);
    const out = await decoder(reader, info, this.worker_pool);
    return { data: out, header: header };
  }
}

let _;
const decoders = [_, _, 'zlib', 'zlib', _, _, _, _, _, _];
const COMPRESS_BLOCK = [1, 1, 1, 16, 32, 16, 0, 0, 32, 256];
const compressions = ['NO','RLE','ZIPS','ZIP','PIZ','PXR24','B44','B44A','DWAA','DWAB'];

const read_header = (reader) => {
  if (reader.u32() != 20000630) throw 'EXRLoader: file not OpenEXR format.';

  const header = {};
  header.version = reader.u8();

  const spec = reader.u8();
  header.spec = {
    tile: !! ( spec & 2 ),
    deep: !! ( spec & 8 ),
    multi: !! ( spec & 16 ),
  };

  if (spec.tile || spec.deep || spec.multi) throw 'EXRLoader: unsupported file extension.';

  reader.skip(2); // preamble

  let name;
  const att = header.attributes = {};
  while (name = reader.string()) {
    const type = reader.string();
    const size = reader.u32();
    att[name] = reader.attribute(type, size);
  }

  const size = {
    width: att.dataWindow.max[0] - att.dataWindow.min[0] + 1,
    height: att.dataWindow.max[1] - att.dataWindow.min[1] + 1,
    start: att.dataWindow.min[1],
    order: att.lineOrder.code
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

  const sequence = { R: 0, G: 1, B: 2, A: 3 };

  for (let ch of att.channels) {
    const k = ch.type * 2;
    switch (ch.name) {
      case 'R':
      case 'G':
      case 'B':
      case 'A':
        channels.output.info[ch.name] = { stride: sequence[ch.name] * k, bytes: k };
        channels.output.stride += k;
        channels.output.count++;
      default:
        channels.input.stride += k;
    }
  }

  const type = channels.output.info.R.bytes;

  if (channels.output.count == 3) {
    channels.output.info.A = { stride: channels.output.stride, bytes: type },
    channels.output.stride += type;
    channels.output.count++;
  }

  header.size = { width: size.width, height: size.height };
  
  switch (channels.output.count) {
    case 1: header.format = type == 2 ? "r16float" : "r32float"; break;
    case 2: header.format = type == 2 ? "rg16float" : "rg32float"; break;
    case 4: header.format = type == 2 ? "rgba16float" : "rgba32float"; break;
    case 0:
    default: throw `EXRLoader: file doesn't contains recognizable data`;
  }

  // offsets
  let il = block.count; while (il--) reader.i64();

  const algorithm = att.compression.decoder;
  if (!algorithm) throw 'EXRLoader: compression algorithm currently unsupported.'

  const info = { type, size, block, channels, algorithm };

  return { header, info };
}

const decoder = (reader, info, pool) => {
  return dispatch_workers({ reader, info, pool, code: worker_code }, [
    { name: 'phoptics-deflate', url: import.meta.resolve('phoptics-deflate') }
  ]);
}

const worker_code = (() => {
let deflate, tmp_buffer;

onmessage = async (mes) => {
  await load_dynamic(mes.data.imports);

  let algorithm;
  switch (mes.data.algorithm) {
    case 'zlib': algorithm = zlib; break;
    default: 
  }
  const output = algorithm(mes.data);

  postMessage({line: mes.data.line, output: output.buffer}, [output.buffer]);
}

const zlib = (data) => {
  const line = data.line;
  const input = new Uint8Array(data.input);
  const { type, size, block, channels } = data.info;

  const end = line + block.height;
  const height = end > size.height ? end % block.height : block.height;
  
  const input_line_bytes = size.width * channels.input.stride;
  const input_bytes = input_line_bytes * height;

  const tmp_buffer_bytes = input_line_bytes * block.height * 2;
  if (!tmp_buffer || tmp_buffer.byteLength < tmp_buffer_bytes) tmp_buffer = new ArrayBuffer(tmp_buffer_bytes);
  const out_bytes = new Uint8Array(tmp_buffer, 0, input_bytes);
  const tmp_bytes = new Uint8Array(tmp_buffer, input_bytes, input_bytes);
  
  if (!deflate) deflate = new imports['phoptics-deflate'].Decompressor();
  
  deflate.zlib(input, tmp_bytes);
  
  predictor(tmp_bytes);
  interleave(tmp_bytes, out_bytes);
  
  const type_constructor = type == 2 ? Uint16Array : Float32Array;
  const output_line_el = size.width * channels.output.stride / type;
  const output = new type_constructor(output_line_el * height);
  const input_line_el = input_line_bytes / type;
  const uncompressed = new type_constructor(out_bytes.buffer, 0, input_line_el * height);

  populate(output, output_line_el, uncompressed, channels, block.width, height);

  return output;
}

const populate = (dst, dst_stride, src, channels, width, height) => {
  const output_stride = channels.output.stride / dst.BYTES_PER_ELEMENT;
  const ch_blocks = channels.input.stride / dst.BYTES_PER_ELEMENT;
  const ch_count = channels.input.info.length;
  for (let i = 0; i < height; i++) {
    for (let ch = 0; ch < ch_count; ch++) {
      const src_channel = channels.input.info[ch];
      const dst_channel = channels.output.info[src_channel.name];
      if (!dst_channel) continue;
      const stride = dst_channel.stride / (src_channel.type * 2);
      const src_line = (i * ch_blocks + ch) * width, dst_line = i * dst_stride;
      for (let j = 0; j < width; j++) dst[dst_line + j * output_stride + stride] = src[src_line + j];
    }
  }
}

const predictor = (stream) => {
  for (let t = 1; t < stream.length; t++) 
    stream[t] = stream[t-1] + stream[t] - 128;
}

const interleave = (src, dst) => { // TODO: optimize (?)
	let s = 0, t1 = 0, t2 = ((src.length + 1) / 2) | 0;
	const stop = src.length - 1;
	while (true) {
		if (s > stop) break;
		dst[s++] = src[t1++];
		if (s > stop) break;
		dst[s++] = src[t2++];
	}
}
}).toString();

class EXRReader {
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
      case 'lineOrder': return { code };
      case 'chlist': return this.channels(len);
      case 'string': return this.string_len(len);
      default:
        this.offset += len;
        return type + "/skipped";
    }
  }

  skip(b) { this.offset += b }
}

const import_code = (() => {
  const imports = [];
  const load_dynamic = async (list) => {
    const loading = [];
    for (let entry of list)
      if (!imports[entry.name])
        loading.push(import(entry.url).then(imp => imports[entry.name] = imp))

    return await Promise.all(loading);
  }
}).toString();
let process_code = (str) => str.substring(str.indexOf('{') + 1, str.lastIndexOf('}'));
let build_worker = (body) => ([process_code(import_code), process_code(body)]).join(' ');
let dispatch_workers = (decoder, imports = []) => {
  return new Promise((res, rej) => {
    const { reader, info, pool, code } = decoder;
    const { type, size, block, channels, algorithm } = info;
    const type_constructor = type == 2 ? Uint16Array : Float32Array;
    const line_stride = size.width * channels.output.stride / type;
    const output = new type_constructor(line_stride * size.height);

    const block_list = []
    let block_count = block.count; while (block_count--) {
      let line = reader.i32() - size.start, byte_length = reader.i32();
      block_list.push({ line, byte_length, byte_start: reader.offset });
      reader.skip(byte_length);
    }

    // worker logic
    let worker, processed = 0;
    const worker_code = build_worker(code);
    const worker_url = URL.createObjectURL(new Blob([worker_code]));
    const onmessage = (mes) => {
      // dispatch next
      let release = false;
      if (++processed != block.count) {
        const b = block_list.pop();
        if (b) {
          const input = reader.bytes.buffer.slice(b.byte_start, b.byte_start + b.byte_length);
          mes.target.postMessage({ algorithm: algorithm, input, line: b.line, info, imports }, [input]);
        } else release = true;
      } else release = true;

      // process
      const line = mes.data.line, data = new type_constructor(mes.data.output);
      output.set(data, line * line_stride);

      // finalize
      if (release) pool.release(mes.target);
      if (processed == block.count) res(output);
    }

    while (worker = pool.acquire(worker_url)) {
      worker.onmessage = onmessage;
      const b = block_list.pop();
      if (!b) {
        pool.release(worker);
        break;
      }
      const input = reader.bytes.buffer.slice(b.byte_start, b.byte_start + b.byte_length);
      worker.postMessage({ algorithm: algorithm, input, line: b.line, info, imports }, [input]);
    }
  });
}

class WorkerPool {
  constructor(max) {
    this.pool = new Array();
    this.count = 0;
    this.max = max || Math.min(8, navigator.hardwareConcurrency / 2 | 0);
  }

  acquire(url) {
    if (this.count == this.max) return undefined;
    this.count++;
    if (this.pool.length) return this.pool.pop();
    return new Worker(url);
  }

  release(worker) {
    this.count--;
    this.pool.push(worker);
  }

  terminate() {
    for (let worker of this.pool) worker.terminate();
    this.count = 0;
    this.pool.length = 0;
  }
}