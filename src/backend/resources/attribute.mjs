export class Attribute {
  constructor(options = {}) {
    this.buffer = options.buffer;
    this.byte_offset = options.byte_offset;
    this.byte_size = options.byte_size;
  }
}