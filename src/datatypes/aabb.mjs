import { Vec3 } from "./vec3.mjs";

export class AABB extends Float32Array {
  static byte_size = 24;

  constructor(array_buffer, byte_offset) {
    if (array_buffer) {
      super(array_buffer, byte_offset, 6);
    } else {
      super(6);
    }

    this.center = new Vec3(this.buffer, this.byteOffset);
    this.extent = new Vec3(this.buffer, this.byteOffset + 12);
  }

  set(center, extent) {
    this.center.copy(center);
    this.extent.copy(extent);
    return this;
  }

  set_bounds(min, max) {
    this.center.copy(min).add(max).mul_f32(.5);
    this.extent.copy(max).sub(this.center);
    return this;
  }

  get_bounds(min, max) {
    min.copy(this.center).sub(this.extent);
    max.copy(this.center).add(this.extent);
  }

  copy(b) {
    return this.set(b.center, b.extent);  
  }

  affine(m) {
    this.center.affine(m);

    const x = this.extent[0], y = this.extent[1], z = this.extent[2];
    this.extent[0] = x * Math.abs(m[0]) + y * Math.abs(m[1]) + z * Math.abs(m[2]);
    this.extent[1] = x * Math.abs(m[4]) + y * Math.abs(m[5]) + z * Math.abs(m[6]);
    this.extent[2] = x * Math.abs(m[8]) + y * Math.abs(m[9]) + z * Math.abs(m[10]);
    return this;
  }
}