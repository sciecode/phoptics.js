import { Format } from 'phoptics';
import { TaskQueue } from '../common/task_queue.mjs';
import { DataReader } from '../common/data_reader.mjs';

import zlib from '../common/zlib.mjs';
import exr_worker from './exr_worker.mjs';

let process_code = (str) => str.substring(str.indexOf('{') + 1, str.lastIndexOf('}'));

export class EXRLoader {
  constructor(options = {}) {
    const worker_url = URL.createObjectURL(
      new Blob([
        process_code(zlib.toString()) +
        process_code(exr_worker.toString())
      ])
    );
    const task_options = {
      workers: options.workers,
      max_workers: options.max_workers || 8,
      factor: options.factor || .25
    }
    this.tasks = new TaskQueue(worker_url, task_options);
    URL.revokeObjectURL(worker_url);
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

  dispose() { this.tasks.dispose(); }
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
    case 1: header.format = type == 2 ? Format.R16_FLOAT : Format.R32_FLOAT; break;
    case 2: header.format = type == 2 ? Format.RG16_FLOAT : Format.RG32_FLOAT; break;
    case 4: header.format = type == 2 ? Format.RGBA16_FLOAT : Format.RGBA32_FLOAT; break;
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

    const data = {
      info,
      blocks,
      output,
      algorithm,
      line_stride,
      len: block.count,
      fill: fill,
      input: reader.bytes.buffer,
      type: type_constructor,
      processed: 0,
    }

    const dispatch = (worker, data, output) => {
      if (data.blocks.length) {
        const block = data.blocks.pop();
        const input = data.input.slice(block.byte_start, block.byte_start + block.byte_length);
        const transferable = output ? [input, output] : [input];
        worker.postMessage({
          input: input,
          output,
          algorithm: data.algorithm,
          info: data.info,
          line: block.line,
          fill: data.fill,
        }, transferable);
        return true;
      }
      return false;
    }

    const fulfill = (job, mes) => {
      const line = mes.data.line, data = new job.type(mes.data.output);
      job.output.set(data, line * job.line_stride);

      if (++job.processed == job.len) {
        res(job.output);
        return { finished: true };
      }
      
      return { finished: false, extra: data.buffer };
    }

    tasks.enqueue({ data, dispatch, fulfill });
  });
}

class EXRReader extends DataReader {
  constructor(buffer) { super(buffer); }

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
}