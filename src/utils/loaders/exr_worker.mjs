export default () => {

  // COMMON

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

  let deflate, tmp_buffer;
  onmessage = async (mes) => {
    const data = mes.data;

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

  // DECOMPRESSORS

  const raw = (data, cache) => new cache.type(cache.input);

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
    
    if (!deflate) deflate = new Decompressor();
    
    deflate.zlib(new Uint8Array(cache.input), tmp_bytes);
    
    predictor(tmp_bytes);
    interleave(tmp_bytes, out_bytes);
    
    const input_line_el = input_line_bytes / type;
    const src = new cache.type(out_bytes.buffer, 0, input_line_el * height);

    return src;
  }
}