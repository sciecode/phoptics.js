import { Plane } from "./plane.mjs";
import { Vec3 } from "./vec3.mjs";

export class Frustum {
  static byte_size = 96;

  constructor(array_buffer, byte_offset = 0) {
    if (!array_buffer) {
      array_buffer = new ArrayBuffer(Frustum.byte_size);
    }

    this.planes = new Array(6);

    let offset = byte_offset;
    for (let i = 0; i < 6; i++) {
      this.planes[i] = new Plane(array_buffer, offset);
      offset += Plane.byte_size;
    }
  }

  set_projection(m) {
    this.planes[0].set_f32(m[12] - m[8], m[13] - m[9], m[14] - m[10], m[15] - m[11]).normalize()  // N
    this.planes[1].set_f32(m[12] - m[0], m[13] - m[1], m[14] - m[2], m[15] - m[3]).normalize()    // R
    this.planes[2].set_f32(m[12] - m[4], m[13] - m[5], m[14] - m[6], m[15] - m[7]).normalize()    // T
    this.planes[3].set_f32(m[8], m[9], m[10], m[11]).normalize()                                  // F
    this.planes[4].set_f32(m[12] + m[0], m[13] + m[1], m[14] + m[2], m[15] + m[3]).normalize()    // L
    this.planes[5].set_f32(m[12] + m[4], m[13] + m[5], m[14] + m[6], m[15] + m[7]).normalize()    // B
  }

  sphere_test(center, radius) {
    for (let i = 0; i < 6; i++)
      if (this.planes[i].distance(center) < -radius) 
        return false;
    return true;
  }

  aabb_test(aabb) {
    aabb.get_bounds(_min, _max);
    for (let i = 0; i < 6; i++) {
      const normal = this.planes[i].normal;
      _vec[0] = normal[0] > 0 ? _max[0] : _min[0];
      _vec[1] = normal[1] > 0 ? _max[1] : _min[1];
      _vec[2] = normal[2] > 0 ? _max[2] : _min[2];
      if (this.planes[i].distance(_vec) < 0) return false;
    }
    return true;
  }
}

const _buffer = new ArrayBuffer(3 * Vec3.byte_size);
const _vec = new Vec3(_buffer, 0);
const _min = new Vec3(_buffer, Vec3.byte_size);
const _max = new Vec3(_buffer, 2 * Vec3.byte_size);