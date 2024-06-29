export class DataReader {
  constructor(buffer) {
    this.offset = 0;
    this.dv = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this.decoder = new TextDecoder();
  }

  u8() {
    const v = this.dv.getUint8(this.offset, true);
    this.offset += 1;
    return v;
  };

  i8() {
    const v = this.dv.getInt8(this.offset, true);
    this.offset += 1;
    return v;
  };

  u16() {
    const v = this.dv.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  };

  i16() {
    const v = this.dv.getInt16(this.offset, true);
    this.offset += 2;
    return v;
  };

  u32() {
    const v = this.dv.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  };

  i32() {
    const v = this.dv.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  };

  u64() {
    const v = this.dv.getBigUint64(this.offset, true);
    this.offset += 8;
    return v;
  };

  i64() {
    const v = this.dv.getBigInt64(this.offset, true);
    this.offset += 8;
    return v;
  };

  f32() {
    const v = this.dv.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  };

  f64() {
    const v = this.dv.getFloat64(this.offset, true);
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

  skip(b) { this.offset += b; }
}