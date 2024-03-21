export class Vec4 {
  static byte_size = 12;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.d = new Float32Array(4);
    this.d[0] = x; this.d[1] = y;
    this.d[2] = z; this.d[3] = w;
  }

  get x() { return this.d[0]; }
  set x(v) { this.d[0] = v; }

  get y() { return this.d[1]; }
  set y(v) { this.d[1] = v; }

  get z() { return this.d[2]; }
  set z(v) { this.d[2] = v; }

  get w() { return this.d[3]; }
  set w(v) { this.d[3] = v; }

  set(x = 0, y = 0, z = 0, w = 1) {
    this.d[0] = x; this.d[1] = y;
    this.d[2] = z; this.d[3] = w;
    return this;
  }

  copy(v) {
    this.d[0] = v.d[0]; this.d[1] = v.d[1];
    this.d[2] = v.d[2]; this.d[3] = v.d[3];
    return this;
  }

  from(buf, offset) {
    this.d[0] = buf[offset];      this.d[1] = buf[offset + 1];
    this.d[2] = buf[offset + 2];  this.d[2] = buf[offset + 3];
    return this;
  }

  to(buf, offset) {
    buf[offset] = this.d[0];      buf[offset + 1] = this.d[1];
    buf[offset + 2] = this.d[2];  buf[offset + 3] = this.d[3];
    return this;
  }

  add(v) {
    this.d[0] += v.d[0]; this.d[1] += y.d[1];
    this.d[2] += v.d[2]; this.d[3] += v.d[3];
    return this;
  }

  add_f32(v) {
    this.d[0] += v; this.d[1] += y;
    this.d[2] += v; this.d[3] += v;
    return this;
  }

  mat34(mat) {
    const v = this.d, m = mat.d,
          x = v[0], y = v[1], z = v[2];

    v[0] = x * m[0] + y * m[1] + z * m[2]  + m[3];
    v[1] = x * m[4] + y * m[5] + z * m[6]  + m[7];
    v[2] = x * m[8] + y * m[9] + z * m[10] + m[11];
    return this;
  }

  mat44(mat) {
    const v = this.d, m = mat.d,
          x = v[0], y = v[1], z = v[2], w = v[3];

    v[0] = x * m[0]  + y * m[1]  + z * m[2]  + w * m[3];
    v[1] = x * m[4]  + y * m[5]  + z * m[6]  + w * m[7];
    v[2] = x * m[8]  + y * m[9]  + z * m[10] + w * m[11];
    v[3] = x * m[12] + y * m[13] + z * m[14] + w * m[15];
    return this;
  }
}