export class Vec2 extends Float32Array {
  static byte_size = 8;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 2);
      this.fill(0);
    } else super(2);
  }

  get x() { return this[0]; }
  set x(v) { this[0] = v; }

  get y() { return this[1]; }
  set y(v) { this[1] = v; }

  get width() { return this[0]; }
  set width(v) { this[0] = v; }

  get height() { return this[1]; }
  set height(v) { this[1] = v; }

  get theta() { return this[0]; }
  set theta(v) { this[0] = v; }

  get phi() { return this[1]; }
  set phi(v) { this[1] = v; }

  set(x = 0, y = 0) {
    this[0] = x; this[1] = y;
    return this;
  }

  copy(v) {
    this[0] = v[0]; this[1] = v[1];
    return this;
  }

  from(buf, offset) {
    this[0] = buf[offset]; this[1] = buf[offset + 1];
    return this;
  }

  to(buf, offset) {
    buf[offset] = this[0]; buf[offset + 1] = this[1];
    return this;
  }

  add(v) {
    this[0] += v[0]; this[1] += v[1];
    return this;
  }

  add_f32(v) {
    this[0] += v; this[1] += v;
    return this;
  }

  sub(v) {
    this[0] -= v[0]; this[1] -= v[1];
    return this;
  }

  sub_f32(v) {
    this[0] -= v; this[1] -= v;
    return this;
  }

  mul(v) {
    this[0] *= v[0]; this[1] *= v[1];
    return this;
  }

  mul_f32(v) {
    this[0] *= v; this[1] *= v;
    return this;
  }

  div(v) {
    this[0] /= v[0]; this[1] /= v[1];
    return this;
  }

  div_f32(v) {
    this[0] /= v; this[1] /= v;
    return this;
  }

  neg() {
    this[0] = -this[0]; this[1] = -this[1];
    return this;
  }

  length() {
    return Math.sqrt(this[0] * this[0] + this[1] * this[1]);
  }

  unit() {
    return this.mul_f32(1 / this.length());
  }

  dot(v) {
    return this[0] * v[0] + this[1] * v[1];
  }

  squared_distance(v) {
    const dx = this[0] - v[0], dy = this[1] - v[1];
    return dx * dx + dy * dy;
  }
}