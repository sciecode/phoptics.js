import { Vec3 } from "./vec3.mjs";

export class Plane extends Float32Array {
  static byte_size = 16;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 4);
    } else {
      super(4);
    }

    this.normal = new Vec3(this.buffer, this.byteOffset);
    this[1] = 1; // +Y normal
    this[3] = 0; // plane at origin
  }

  get offset() { return this[3]; }
  set offset(v) { this[3] = v; }

  set(normal, offset) {
    this.normal.copy(normal);
    this[3] = offset;
    return this;
  }

  set_f32(x, y, z, w) {
    this[0] = x; this[1] = y; this[2] = z; this[3] = w;
    return this;
  }

  set_coplanar(v) {
    this[3] = - v.dot(this.normal);
    return this;
  }

  copy(p) {
    this[0] = p[0]; this[1] = p[1]; this[2] = p[2]; this[3] = p[3];
    return this;
  }

  unit() {
		const scl = 1 / this.normal.length();
		this.normal.mul_f32(scl);
		this[3] *= scl;
		return this;
  }

  distance(v) {
    return this.normal.dot(v) + this[3];
  }
}