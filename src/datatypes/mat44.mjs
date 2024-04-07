export class Mat4x4 extends Float32Array {
  static byte_size = 64;

  constructor() {
    super(16);
    this[0] = this[5] = this[10] = this[15] = 1;
  }

  to(buf, offset) {
    buf.set(this, offset);
    return this;
  }

  copy(mat) {
    super.set(mat);
    return this;
  }

  projection(fov, aspect, near, far) {
    const m = this;
    const range = 1 / (far - near);
    const focal_length = Math.tan((Math.PI - fov) * .5);

    m.fill(0);

    m[0] = focal_length / aspect;
    m[5] = focal_length;
    m[10] = near * range;
    m[11] = near * far * range;
    m[14] = -1;
    return this;
  }
}