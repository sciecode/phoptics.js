export class Vec3 extends Float32Array {
  static byte_size = 12;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 3);
      this.fill(0);
    } else super(3);
  }

  get x() { return this[0]; }
  set x(v) { this[0] = v; }

  get y() { return this[1]; }
  set y(v) { this[1] = v; }

  get z() { return this[2]; }
  set z(v) { this[2] = v; }

  set(x = 0, y = 0, z = 0) {
    this[0] = x; this[1] = y; this[2] = z;
    return this;
  }

  copy(v) {
    this[0] = v[0]; this[1] = v[1]; this[2] = v[2];
    return this;
  }

  from(buf, offset) {
    this[0] = buf[offset]; this[1] = buf[offset + 1]; this[2] = buf[offset + 2];
    return this;
  }

  to(buf, offset) {
    buf[offset] = this[0]; buf[offset + 1] = this[1]; buf[offset + 2] = this[2];
    return this;
  }

  add(v) {
    this[0] += v[0]; this[1] += v[1]; this[2] += v[2];
    return this;
  }

  add_f32(v) {
    this[0] += v; this[1] += v; this[2] += v;
    return this;
  }

  sub(v) {
    this[0] -= v[0]; this[1] -= v[1]; this[2] -= v[2];
    return this;
  }

  sub_f32(v) {
    this[0] -= v; this[1] -= v; this[2] -= v;
    return this;
  }

  mul(v) {
    this[0] *= v[0]; this[1] *= v[1]; this[2] *= v[2];
    return this;
  }

  mul_f32(v) {
    this[0] *= v; this[1] *= v; this[2] *= v;
    return this;
  }

  div(v) {
    this[0] /= v[0]; this[1] /= v[1]; this[2] /= v[2];
    return this;
  }

  div_f32(v) {
    this[0] /= v; this[1] /= v; this[2] /= v;
    return this;
  }

  neg() {
    this[0] = -this[0]; this[1] = -this[1]; this[2] = -this[2];
    return this;
  }

  length() {
    return Math.sqrt(this[0] * this[0] + this[1] * this[1] + this[2] * this[2]);
  }

  unit() {
    return this.mul_f32(1 / this.length());
  }

  dot(v) {
    return this[0] * v[0] + this[1] * v[1] + this[2] * v[2];
  }

  cross(v) {
    const m = this, n = v;
    const x = m[0], y = m[1], z = m[2];

    m[0] = y * n[2] - z * n[1];
    m[1] = z * n[0] - x * n[2];
    m[2] = x * n[1] - y * n[0];
    return this;
  }

  squared_distance(v) {
    const dx = this[0] - v[0], dy = this[1] - v[1], dz = this[2] - v[2];
    return dx * dx + dy * dy + dz * dz;
  }

  affine(mat) {
    const v = this, m = mat,
      x = v[0], y = v[1], z = v[2];

    v[0] = x * m[0] + y * m[1] + z * m[2] + m[3];
    v[1] = x * m[4] + y * m[5] + z * m[6] + m[7];
    v[2] = x * m[8] + y * m[9] + z * m[10] + m[11];
    return this;
  }
}