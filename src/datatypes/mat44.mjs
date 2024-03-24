export class Mat4x4 {
  static byte_size = 64;

  constructor() {
    this.data = new Float32Array(16);
    this.data[0] = this.data[5] = this.data[10] = this.data[15] = 1;
  }

  to(buf, offset) {
    buf.set(this.data, offset);
    return this;
  }

  copy(mat) {
    this.data.set(mat.data);
    return this;
  }

  projection(fov, aspect, near, far) {
    const m = this.data;
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