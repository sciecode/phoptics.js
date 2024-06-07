import { decode_f16 } from 'phoptics/utils/data/decoder.mjs';

export class EXRLoader {
  constructor() {
    this.tasks = new TaskQueue();
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
    const out = await decoder(reader, info, this.tasks);
    return { data: out, header: header };
  }

  dispose() {
    this.tasks.dispose();
  }
}

let _;
const decoders = ['raw', 'rle', 'zlib', 'zlib', _, _, _, _, _, _];
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

  if (header.spec.deep) throw 'EXRLoader: unsupported deep-scan file extension.';
  if (header.spec.tile) throw 'EXRLoader: unsupported tiled-scan file extension.';
  if (header.spec.multi) throw 'EXRLoader: unsupported multi-file extension.';

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

  const sequence = { R: 0, G: 1, B: 2, A: 3, Y: 0 };

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

  let fill;
  const type = channels.output.info.R.bytes;
  
  if (channels.output.count == 3) {
    channels.output.info.A = { stride: channels.output.stride, bytes: type },
    channels.output.stride += type;
    channels.output.count++;
    fill = (type == 2) ? 0x3C00 : 1;
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

  const info = { type, size, block, channels, algorithm, fill };

  return { header, info };
}

const decoder = (reader, info, tasks) => {
  return new Promise((res, rej) => {
    const { type, size, block, channels, algorithm, fill } = info;
    const type_constructor = type == 2 ? Uint16Array : Float32Array;
    const line_stride = size.width * channels.output.stride / type;
    const output = new type_constructor(line_stride * size.height);

    const blocks = [];
    let block_count = block.count; while (block_count--) {
      const line = reader.i32() - size.start,
        byte_length = reader.i32(),
        byte_start = reader.offset;
      blocks.push({line, byte_length, byte_start});
      reader.skip(byte_length);
    }

    tasks.enqueue({
      info,
      blocks,
      output,
      algorithm,
      line_stride,
      len: block.count,
      fill: fill,
      input: reader.bytes.buffer,
      type: type_constructor,
      cb: res,
    });
  });
}

const worker_code = (() => {

let imports = [], deflate, tmp_buffer;
const load_dynamic = async (list) => {
  const loading = [];
  for (let entry of list)
    if (!imports[entry.name])
      loading.push(import(entry.url).then(imp => imports[entry.name] = imp))

  return await Promise.all(loading);
}

onmessage = async (mes) => {
  const data = mes.data;
  await load_dynamic(data.imports);

  let algorithm;
  switch (data.algorithm) {
    case 'zlib': algorithm = zlib; break;
    case 'rle' : algorithm = rle; break; 
    case 'raw' : algorithm = raw; break;
    default: 
  }
  
  const info = read_block(data);
  const src = info.is_compressed ? algorithm(data, info) : new info.type(info.input);
  populate(info.output, info.dst_stride, src, data.info.channels, data.info.block.width, info.height);
  postMessage({line: data.line, output: info.output.buffer}, [info.output.buffer]);
}

const read_block = (data) => {
  const line = data.line;
  const { type, size, block, channels } = data.info;
  
  const end = line + block.height;
  const height = end > size.height ? end % block.height : block.height;
  
  const input_line_bytes = size.width * channels.input.stride;
  const input_bytes = input_line_bytes * height;
  const is_compressed = input_bytes != data.input.byteLength;

  const input = data.input;
  const type_constructor = type == 2 ? Uint16Array : Float32Array;
  const output_line_stride = size.width * channels.output.stride;
  const output_line_el = output_line_stride / type;
  let output;
  if (data.output && data.output.byteLength >= output_line_stride * height) {
    output = new type_constructor(data.output, 0, output_line_el * height);
  } else {
    output = new type_constructor(output_line_el * height);
  }

  output.fill(data.fill ? data.fill : 0);

  return {
    input,
    output,
    height,
    is_compressed,
    type: type_constructor,
    dst_stride: output_line_el,
  }
}

const raw = (data, cache) => new cache.type(cache.input);

const rle = (data, cache) => {
  const { type, size, block, channels } = data.info;
  const height = cache.height;
  
  const input_line_bytes = size.width * channels.input.stride;
  const input_bytes = input_line_bytes * height;
  
  const tmp_buffer_bytes = input_line_bytes * block.height * 2;
  if (!tmp_buffer || tmp_buffer.byteLength < tmp_buffer_bytes) tmp_buffer = new ArrayBuffer(tmp_buffer_bytes);
  const out_bytes = new Uint8Array(tmp_buffer, 0, input_bytes);
  const tmp_bytes = new Uint8Array(tmp_buffer, input_bytes, input_bytes);
 
  runlength(new Uint8Array(cache.input), tmp_bytes);
  
  predictor(tmp_bytes);
  interleave(tmp_bytes, out_bytes);
  
  const input_line_el = input_line_bytes / type;
  const src = new cache.type(out_bytes.buffer, 0, input_line_el * height);

  return src;
}

const zlib = (data, cache) => {
  const { type, size, block, channels } = data.info;
  const height = cache.height;
  
  const input_line_bytes = size.width * channels.input.stride;
  const input_bytes = input_line_bytes * height;
  
  const tmp_buffer_bytes = input_line_bytes * block.height * 2;
  if (!tmp_buffer || tmp_buffer.byteLength < tmp_buffer_bytes) tmp_buffer = new ArrayBuffer(tmp_buffer_bytes);
  const out_bytes = new Uint8Array(tmp_buffer, 0, input_bytes);
  const tmp_bytes = new Uint8Array(tmp_buffer, input_bytes, input_bytes);
  
  if (!deflate) deflate = new imports['phoptics-deflate'].Decompressor();
  
  deflate.zlib(new Uint8Array(cache.input), tmp_bytes);
  
  predictor(tmp_bytes);
  interleave(tmp_bytes, out_bytes);
  
  const input_line_el = input_line_bytes / type;
  const src = new cache.type(out_bytes.buffer, 0, input_line_el * height);

  return src;
}

const populate = (dst, dst_stride, src, channels, width, height) => {
  const output_stride = channels.output.stride / dst.BYTES_PER_ELEMENT;
  const ch_blocks = channels.input.stride / dst.BYTES_PER_ELEMENT;
  const ch_count = channels.input.info.length;

  for (let ch = 0; ch < ch_count; ch++) {
    const src_channel = channels.input.info[ch];
    const dst_channel = channels.output.info[src_channel.name];
    if (!dst_channel) continue;
    for (let i = 0; i < height; i++) {
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

const interleave = (src, dst) => {
  let s = 0, t1 = 0, t2 = ((src.length + 1) / 2) | 0;
  const stop = src.length - 1;
  while (true) {
    if (s > stop) break;
    dst[s++] = src[t1++];
    if (s > stop) break;
    dst[s++] = src[t2++];
  }
}

const runlength = (src, dst) => {
  let size = src.length, s = 0, d = 0;
  while (size > 0) {
    const l = (src[s++] << 24) >> 24;
    if (l < 0) {
      const count = -l;
      size -= count + 1;
      for (let i = 0; i < count; i++) dst[d++] = src[s++];
    } else {
      const count = l;
      size -= 2;
      const value = src[s++];
      for (let i = 0; i < count + 1; i++) dst[d++] = value;
    }
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
      case 'lineOrder': return { code: this.u8() };
      case 'chlist': return this.channels(len);
      case 'string': return this.string_len(len);
      default:
        this.offset += len;
        return type + "/skipped";
    }
  }

  skip(b) { this.offset += b }
}

let zlib_imports = [
  { name: 'phoptics-deflate', url: import.meta.resolve('phoptics-deflate') }
];
let empty = [];

let dependencies = (algo) => {
  switch (algo) {
    case 'zlib': return zlib_imports;
    default: return empty;
  }
}

let process_code = (str) => str.substring(str.indexOf('{') + 1, str.lastIndexOf('}'));

class TaskQueue {
  constructor() {
    const workers = Math.min(8, navigator.hardwareConcurrency / 2 | 0);
    const worker_url = URL.createObjectURL(new Blob([process_code(worker_code)]));

    this.jobs = [];
    this.running = false;
    this.pool = new Array(workers);
    this.terminated = false;
    for (let i = 0; i < workers; i++) this.pool[i] = new Worker(worker_url);
  }

  enqueue(info) { 
    this.jobs.push({ ...info, processed: 0 });
    if (!this.running) {
      this.running = true;
      for (let worker of this.pool) this.submit(worker);
    }
  }

  submit(worker, output) {
    let empty = true;
    for (let i = 0; i < this.jobs.length; i++) {
      const job = this.jobs[i];
      if (job.blocks.length) {
        const block = job.blocks.pop();
        worker.onmessage = ((mes) => { this.finish(i, mes); }).bind(this);
        const input = job.input.slice(block.byte_start, block.byte_start + block.byte_length);
        const transferable = output ? [input, output] : [input];
        worker.postMessage({
          input: input,
          output,
          algorithm: job.algorithm,
          info: job.info,
          line: block.line,
          fill: job.fill,
          imports: dependencies(job.algorithm),
        }, transferable);
        return false;
      }
      if (job.processed != job.len) empty = false;
    }
    return empty;
  }

  finish(id, mes) {
    const job = this.jobs[id];
    const line = mes.data.line, data = new job.type(mes.data.output);
    job.output.set(data, line * job.line_stride);

    if (++job.processed == job.len) job.cb(job.output);

    const empty = this.submit(mes.target, data.buffer);
    if (empty) {
      this.running = false;
      this.jobs.length = 0;
      if (this.terminated) this.terminate();
    }
  }

  terminate() {
    for (let worker of this.pool) worker.terminate();
  }

  dispose() {
    if (this.running) this.terminated = true;
    else this.terminate();
  }
}