export class BufferWriter {
  constructor(buffer) {
    this.buffer = buffer;
    this.f32 = new Float32Array(this.buffer);
  }

  f32_array(array, byte_offset) {
    this.f32.set(array, byte_offset >> 2);
  }
}