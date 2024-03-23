export class Vec3 {
  static byte_size = 12;

  constructor() {
    this.data = new Float32Array(3);
  }

  get x() { return this.data[0]; }
  set x(v) { this.data[0] = v; }

  get y() { return this.data[1]; }
  set y(v) { this.data[1] = v; }

  get z() { return this.data[2]; }
  set z(v) { this.data[2] = v; }

  set(x = 0, y = 0, z = 0) {
    this.data[0] = x; this.data[1] = y; this.data[2] = z;
    return this;
  }

  copy(v) {
    this.data[0] = v.data[0]; this.data[1] = v.data[1]; this.data[2] = v.data[2];
    return this;
  }

  from(buf, offset) {
    this.data[0] = buf[offset]; this.data[1] = buf[offset + 1]; this.data[2] = buf[offset + 2];
    return this;
  }

  to(buf, offset) {
    buf[offset] = this.data[0]; buf[offset + 1] = this.data[1]; buf[offset + 2] = this.data[2];
    return this;
  }

  add(v) {
    this.data[0] += v.data[0]; this.data[1] += y.data[1]; this.data[2] += v.data[2];
    return this;
  }

  add_f32(v) {
    this.data[0] += v; this.data[1] += y; this.data[2] += v;
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
}