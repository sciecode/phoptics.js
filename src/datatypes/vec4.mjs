export class Vec4 {
  static byte_size = 16;

  constructor() {
    this.data = new Float32Array(4);
  }

  get x() { return this.data[0]; }
  set x(v) { this.data[0] = v; }

  get y() { return this.data[1]; }
  set y(v) { this.data[1] = v; }

  get z() { return this.data[2]; }
  set z(v) { this.data[2] = v; }

  get w() { return this.data[3]; }
  set w(v) { this.data[3] = v; }

  set(x = 0, y = 0, z = 0, w = 1) {
    this.data[0] = x; this.data[1] = y;
    this.data[2] = z; this.data[3] = w;
    return this;
  }

  copy(v) {
    this.data[0] = v.data[0]; this.data[1] = v.data[1];
    this.data[2] = v.data[2]; this.data[3] = v.data[3];
    return this;
  }

  from(buf, offset) {
    this.data[0] = buf[offset];     this.data[1] = buf[offset + 1];
    this.data[2] = buf[offset + 2]; this.data[2] = buf[offset + 3];
    return this;
  }

  to(buf, offset) {
    buf[offset]     = this.data[0]; buf[offset + 1] = this.data[1];
    buf[offset + 2] = this.data[2]; buf[offset + 3] = this.data[3];
    return this;
  }

  add(v) {
    this.data[0] += v.data[0]; this.data[1] += y.data[1];
    this.data[2] += v.data[2]; this.data[3] += v.data[3];
    return this;
  }

  add_f32(v) {
    this.data[0] += v; this.data[1] += y;
    this.data[2] += v; this.data[3] += v;
    return this;
  }

  transform(mat) {
    const v = this.data, m = mat.data,
          x = v[0], y = v[1], z = v[2];

    v[0] = x * m[0] + y * m[1] + z * m[2]  + m[3];
    v[1] = x * m[4] + y * m[5] + z * m[6]  + m[7];
    v[2] = x * m[8] + y * m[9] + z * m[10] + m[11];
    return this;
  }

  mat44(mat) {
    const v = this.data, m = mat.data,
          x = v[0], y = v[1], z = v[2], w = v[3];

    v[0] = x * m[0]  + y * m[1]  + z * m[2]  + w * m[3];
    v[1] = x * m[4]  + y * m[5]  + z * m[6]  + w * m[7];
    v[2] = x * m[8]  + y * m[9]  + z * m[10] + w * m[11];
    v[3] = x * m[12] + y * m[13] + z * m[14] + w * m[15];
    return this;
  }
}