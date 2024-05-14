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
}