import { Plane } from "./plane.mjs";

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
    this.planes[0].set_f32(m[12] + m[0], m[13] + m[1], m[14] + m[2], m[15] + m[3]).normalize()    // L
    this.planes[1].set_f32(m[12] - m[0], m[13] - m[1], m[14] - m[2], m[15] - m[3]).normalize()    // R
    this.planes[2].set_f32(m[12] + m[4], m[13] + m[5], m[14] + m[6], m[15] + m[7]).normalize()    // B
    this.planes[3].set_f32(m[12] - m[4], m[13] - m[5], m[14] - m[6], m[15] - m[7]).normalize()    // T
    this.planes[4].set_f32(m[12] - m[8], m[13] - m[9], m[14] - m[10], m[15] - m[11]).normalize()  // N
    this.planes[5].set_f32(m[8], m[9], m[10], m[11]).normalize()                                  // F
  }
}