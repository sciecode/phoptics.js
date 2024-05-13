export class Vec4 extends Float32Array {
  static byte_size = 16;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 4);
      this.fill(0);
    } else super(4);
  }

  get x() { return this[0]; }
  set x(v) { this[0] = v; }

  get y() { return this[1]; }
  set y(v) { this[1] = v; }

  get z() { return this[2]; }
  set z(v) { this[2] = v; }

  get w() { return this[3]; }
  set w(v) { this[3] = v; }

  set(x = 0, y = 0, z = 0, w = 1) {
    this[0] = x; this[1] = y;
    this[2] = z; this[3] = w;
    return this;
  }

  copy(v) {
    this[0] = v[0]; this[1] = v[1];
    this[2] = v[2]; this[3] = v[3];
    return this;
  }

  from(buf, offset) {
    this[0] = buf[offset];     this[1] = buf[offset + 1];
    this[2] = buf[offset + 2]; this[2] = buf[offset + 3];
    return this;
  }

  to(buf, offset) {
    buf[offset]     = this[0]; buf[offset + 1] = this[1];
    buf[offset + 2] = this[2]; buf[offset + 3] = this[3];
    return this;
  }

  add(v) {
    this[0] += v[0]; this[1] += y[1];
    this[2] += v[2]; this[3] += v[3];
    return this;
  }

  add_f32(v) {
    this[0] += v; this[1] += y;
    this[2] += v; this[3] += v;
    return this;
  }

  affine(mat) {
    const v = this, m = mat,
          x = v[0], y = v[1], z = v[2];

    v[0] = x * m[0] + y * m[1] + z * m[2]  + m[3];
    v[1] = x * m[4] + y * m[5] + z * m[6]  + m[7];
    v[2] = x * m[8] + y * m[9] + z * m[10] + m[11];
    return this;
  }

  project(mat) {
    const v = this, m = mat,
          x = v[0], y = v[1], z = v[2], w = v[3];

    v[0] = x * m[0]  + y * m[1]  + z * m[2]  + w * m[3];
    v[1] = x * m[4]  + y * m[5]  + z * m[6]  + w * m[7];
    v[2] = x * m[8]  + y * m[9]  + z * m[10] + w * m[11];
    v[3] = x * m[12] + y * m[13] + z * m[14] + w * m[15];
    return this;
  }
}