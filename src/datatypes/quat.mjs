import { Vec3 } from "./vec3.mjs";

export class Quat extends Float32Array {
  static byte_size = 16;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 4);
      this.fill(0);
    } else {
      super(4);
    }

    this.axis = new Vec3(this.buffer, this.byteOffset);
    this[3] = 1;
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

  set_axis_angle(axis, angle = 0) {
		const half = angle * .5, s = Math.sin(half), c = Math.cos(half);
		this[0] = axis[0] * s; this[1] = axis[1] * s;
		this[2] = axis[2] * s; this[3] = c;
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

  rot_x(angle) {
    const half = angle * .5, x = Math.sin(half), w = Math.cos(half);
    const qx = this[0], qy = this[1], qz = this[2], qw = this[3];

		this[0] = x * qw + w * qx;
		this[1] = w * qy - x * qz;
		this[2] = w * qz + x * qy;
		this[3] = w * qw - x * qx;
    return this;
  }

  rot_y(angle) {
    const half = angle * .5, y = Math.sin(half), w = Math.cos(half);
    const qx = this[0], qy = this[1], qz = this[2], qw = this[3];

		this[0] = w * qx + y * qz;
		this[1] = y * qw + w * qy;
		this[2] = w * qz - y * qx;
		this[3] = w * qw - y * qy;
    return this;
  }

  rot_z(angle) {
    const half = angle * .5, z = Math.sin(half), w = Math.cos(half);
    const qx = this[0], qy = this[1], qz = this[2], qw = this[3];

		this[0] = w * qx - z * qy;
		this[1] = w * qy + z * qx;
		this[2] = z * qw + w * qz;
		this[3] = w * qw - z * qz;
    return this;
  }

  mul(q) {
		const x = this[0], y = this[1], z = this[2], w = this[3];
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];

		this[0] = x * qw + w * qx + y * qz - z * qy;
		this[1] = y * qw + w * qy + z * qx - x * qz;
		this[2] = z * qw + w * qz + x * qy - y * qx;
		this[3] = w * qw - x * qx - y * qy - z * qz;
    return this;
  }

  invert() {
    this.axis.neg();
    return this;
  }

  length() {
    return Math.sqrt(this[0] * this[0] + this[1] * this[1] + this[2] * this[2] + this[3] * this[3]);
  }

  unit() {
    const scl = 1 / this.length();
    this[0] *= scl; this[1] *= scl;
    this[2] *= scl; this[3] *= scl;
    return this;
  }
}